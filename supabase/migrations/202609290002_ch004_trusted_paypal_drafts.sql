-- CH-004: bind PayPal provider orders to trusted server-side drafts and
-- atomically record the immutable capture ID during paid finalization.
-- Apply after 202609290001_ch003_atomic_checkout_finalization.sql.

alter table public.orders
  add column if not exists payment_provider_order_id text;

create unique index if not exists orders_provider_order_unique
  on public.orders (payment_processor, payment_provider_order_id)
  where payment_provider_order_id is not null;

create or replace function public.link_paypal_order(
  p_order_id uuid,
  p_paypal_order_id text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
begin
  if nullif(p_paypal_order_id, '') is null then
    raise exception 'invalid_paypal_order_id' using errcode = 'P0001';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then return 'order_not_found'; end if;
  if v_order.payment_processor is distinct from 'paypal' or
     v_order.payment_status is distinct from 'pending' or
     v_order.reservation_status is distinct from 'reserved' then
    return 'invalid_transition';
  end if;
  if v_order.payment_provider_order_id = p_paypal_order_id then
    return 'already_linked';
  end if;
  if v_order.payment_provider_order_id is not null then
    return 'provider_order_mismatch';
  end if;

  update public.orders
  set payment_provider_order_id = p_paypal_order_id, updated_at = now()
  where id = p_order_id;
  return 'linked';
end;
$$;

create or replace function public.finalize_paypal_capture(
  p_order_id uuid,
  p_paypal_order_id text,
  p_capture_id text,
  p_currency text,
  p_amount_cents bigint,
  p_reference_id text,
  p_provider_event_id text
)
returns table(outcome text, order_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_outcome text;
begin
  if nullif(p_capture_id, '') is null then
    raise exception 'invalid_paypal_capture_id' using errcode = 'P0001';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    return query select 'order_not_found'::text, p_order_id;
    return;
  end if;
  if v_order.payment_processor is distinct from 'paypal' or
     v_order.payment_provider_order_id is distinct from p_paypal_order_id then
    return query select 'payment_mismatch'::text, p_order_id;
    return;
  end if;
  if v_order.payment_status = 'paid' and v_order.reservation_status = 'committed' then
    if v_order.payment_transaction_id is distinct from p_capture_id then
      return query select 'payment_mismatch'::text, p_order_id;
    else
      return query select 'already_finalized'::text, p_order_id;
    end if;
    return;
  end if;
  if v_order.payment_status is distinct from 'pending' or
     v_order.reservation_status is distinct from 'reserved' then
    return query select 'invalid_transition'::text, p_order_id;
    return;
  end if;
  if upper(coalesce(p_currency, '')) <> 'USD' or
     p_reference_id is distinct from v_order.order_number or
     p_amount_cents is distinct from round(v_order.total * 100)::bigint then
    return query select 'payment_mismatch'::text, p_order_id;
    return;
  end if;

  update public.orders
  set payment_transaction_id = p_capture_id, updated_at = now()
  where id = p_order_id;

  select f.outcome into v_outcome
  from public.finalize_paid_order(
    p_order_id,
    'paypal',
    p_capture_id,
    p_provider_event_id
  ) f;

  return query select v_outcome, p_order_id;
end;
$$;

revoke all on function public.link_paypal_order(uuid, text) from public, anon, authenticated;
revoke all on function public.finalize_paypal_capture(uuid, text, text, text, bigint, text, text)
  from public, anon, authenticated;

grant execute on function public.link_paypal_order(uuid, text) to service_role;
grant execute on function public.finalize_paypal_capture(uuid, text, text, text, bigint, text, text)
  to service_role;
