-- CH-003: atomic inventory/coupon reservation, idempotent paid finalization,
-- reservation release, status history, and retryable confirmation-email outbox.
-- Apply after 202609280001_ch002_pending_stripe_orders.sql.

alter table public.orders
  add column if not exists reservation_status text not null default 'none',
  add column if not exists reservation_expires_at timestamptz,
  add column if not exists finalized_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'orders_reservation_status_check'
      and conrelid = 'public.orders'::regclass
  ) then
    alter table public.orders
      add constraint orders_reservation_status_check
      check (reservation_status in ('none', 'reserved', 'committed', 'released'));
  end if;
end $$;

create table if not exists public.checkout_outbox (
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique,
  event_type text not null,
  aggregate_id uuid not null references public.orders(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'delivered', 'failed')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  last_error text,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists checkout_outbox_pending_idx
  on public.checkout_outbox (available_at, created_at)
  where status = 'pending';

alter table public.checkout_outbox enable row level security;

create or replace function public.create_checkout_draft(
  p_order jsonb,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
  v_coupon_id uuid;
  v_item record;
  v_stock integer;
  v_coupon record;
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'cart_empty' using errcode = 'P0001';
  end if;

  -- Lock all products in a stable order, then validate aggregate quantities.
  perform p.id
  from public.products p
  join (
    select x.product_id
    from jsonb_to_recordset(p_items) as x(product_id uuid, quantity integer)
    group by x.product_id
  ) requested on requested.product_id = p.id
  order by p.id
  for update of p;

  for v_item in
    select x.product_id, sum(x.quantity)::integer as quantity
    from jsonb_to_recordset(p_items) as x(product_id uuid, quantity integer)
    group by x.product_id
    order by x.product_id
  loop
    if v_item.quantity < 1 then
      raise exception 'invalid_quantity:%', v_item.product_id using errcode = 'P0001';
    end if;

    select stock_quantity into v_stock
    from public.products
    where id = v_item.product_id and is_active = true;

    if not found then
      raise exception 'product_unavailable:%', v_item.product_id using errcode = 'P0001';
    end if;
    if v_stock is not null and v_stock < v_item.quantity then
      raise exception 'insufficient_stock:%', v_item.product_id using errcode = 'P0001';
    end if;

    if v_stock is not null then
      update public.products
      set stock_quantity = stock_quantity - v_item.quantity
      where id = v_item.product_id;
    end if;
  end loop;

  v_coupon_id := nullif(p_order->>'coupon_id', '')::uuid;
  if v_coupon_id is not null then
    select id, is_active, valid_from, valid_until, max_uses, used_count
    into v_coupon
    from public.coupons
    where id = v_coupon_id
    for update;

    if not found or not coalesce(v_coupon.is_active, false) or
       (v_coupon.valid_from is not null and v_coupon.valid_from > now()) or
       (v_coupon.valid_until is not null and v_coupon.valid_until < now()) or
       (v_coupon.max_uses is not null and coalesce(v_coupon.used_count, 0) >= v_coupon.max_uses) then
      raise exception 'coupon_unavailable' using errcode = 'P0001';
    end if;

    update public.coupons
    set used_count = coalesce(used_count, 0) + 1
    where id = v_coupon_id;
  end if;

  insert into public.orders (
    order_number, customer_id, status, payment_status,
    subtotal, shipping_cost, tax_amount, discount_amount, total,
    shipping_address, billing_address, payment_processor,
    payment_transaction_id, customer_notes, coupon_id,
    confirmation_token_hash, reservation_status, reservation_expires_at
  ) values (
    p_order->>'order_number', nullif(p_order->>'customer_id', '')::uuid,
    'pending', 'pending',
    (p_order->>'subtotal')::numeric, (p_order->>'shipping_cost')::numeric,
    (p_order->>'tax_amount')::numeric, (p_order->>'discount_amount')::numeric,
    (p_order->>'total')::numeric, p_order->'shipping_address',
    p_order->'shipping_address', coalesce(nullif(p_order->>'payment_processor', ''), 'stripe'),
    nullif(p_order->>'payment_transaction_id', ''), nullif(p_order->>'customer_notes', ''),
    v_coupon_id, nullif(p_order->>'confirmation_token_hash', ''),
    'reserved', now() + interval '30 minutes'
  )
  returning id into v_order_id;

  insert into public.order_items (
    order_id, product_id, product_name, product_slug, product_image,
    quantity, unit_price, total_price
  )
  select
    v_order_id, x.product_id, x.product_name, x.product_slug, x.product_image,
    x.quantity, x.unit_price, x.total_price
  from jsonb_to_recordset(p_items) as x(
    product_id uuid,
    product_name text,
    product_slug text,
    product_image text,
    quantity integer,
    unit_price numeric,
    total_price numeric
  );

  insert into public.order_status_history (order_id, status, notes, created_at)
  values (v_order_id, 'pending', 'Inventory and coupon capacity reserved', now());

  return v_order_id;
end;
$$;

create or replace function public.finalize_paid_order(
  p_order_id uuid,
  p_provider text,
  p_transaction_id text,
  p_provider_event_id text
)
returns table(outcome text, order_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
begin
  if p_provider not in ('stripe', 'paypal') or nullif(p_transaction_id, '') is null then
    raise exception 'invalid_provider_transaction' using errcode = 'P0001';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    return query select 'order_not_found'::text, p_order_id;
    return;
  end if;
  if v_order.payment_processor::text <> p_provider or
     v_order.payment_transaction_id is distinct from p_transaction_id then
    return query select 'payment_mismatch'::text, p_order_id;
    return;
  end if;
  if v_order.payment_status::text = 'paid' and v_order.reservation_status = 'committed' then
    return query select 'already_finalized'::text, p_order_id;
    return;
  end if;
  if v_order.payment_status::text <> 'pending' or v_order.reservation_status <> 'reserved' then
    return query select 'invalid_transition'::text, p_order_id;
    return;
  end if;

  update public.orders
  set status = 'confirmed', payment_status = 'paid',
      reservation_status = 'committed', finalized_at = now(), updated_at = now()
  where id = p_order_id;

  insert into public.order_status_history (order_id, status, notes, created_at)
  values (p_order_id, 'confirmed', 'Payment confirmed by ' || p_provider, now());

  insert into public.checkout_outbox (event_key, event_type, aggregate_id, payload)
  values (
    'order.confirmed:' || p_order_id::text,
    'order.confirmed',
    p_order_id,
    jsonb_build_object('provider', p_provider, 'providerEventId', p_provider_event_id)
  )
  on conflict (event_key) do nothing;

  return query select 'finalized'::text, p_order_id;
end;
$$;

create or replace function public.create_and_finalize_paid_order(
  p_order jsonb,
  p_items jsonb,
  p_provider text,
  p_transaction_id text,
  p_provider_event_id text
)
returns table(outcome text, order_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
  v_outcome text;
begin
  if p_provider not in ('stripe', 'paypal') or nullif(p_transaction_id, '') is null then
    raise exception 'invalid_provider_transaction' using errcode = 'P0001';
  end if;

  -- Serialize retries for the same provider transaction before checking it.
  perform pg_advisory_xact_lock(hashtextextended(p_provider || ':' || p_transaction_id, 0));

  select id into v_order_id
  from public.orders
  where payment_processor::text = p_provider and payment_transaction_id = p_transaction_id;

  if found then
    if not exists (
      select 1
      from public.orders
      where id = v_order_id
        and payment_status = 'paid'
        and reservation_status = 'committed'
    ) then
      raise exception 'provider_transaction_in_inconsistent_state' using errcode = 'P0001';
    end if;
    return query select 'already_finalized'::text, v_order_id;
    return;
  end if;

  v_order_id := public.create_checkout_draft(
    p_order || jsonb_build_object(
      'payment_processor', p_provider,
      'payment_transaction_id', p_transaction_id
    ),
    p_items
  );

  select f.outcome into v_outcome
  from public.finalize_paid_order(
    v_order_id,
    p_provider,
    p_transaction_id,
    p_provider_event_id
  ) f;

  if v_outcome <> 'finalized' then
    raise exception 'paid_order_finalization_failed:%', v_outcome using errcode = 'P0001';
  end if;

  return query select v_outcome, v_order_id;
end;
$$;

create or replace function public.release_checkout_reservation(
  p_order_id uuid,
  p_reason text,
  p_provider text default null,
  p_transaction_id text default null
)
returns table(outcome text, order_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_item record;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    return query select 'order_not_found'::text, p_order_id;
    return;
  end if;
  if v_order.reservation_status = 'released' then
    return query select 'already_released'::text, p_order_id;
    return;
  end if;
  if (p_provider is not null and v_order.payment_processor is distinct from p_provider) or
     (p_transaction_id is not null and v_order.payment_transaction_id is distinct from p_transaction_id) then
    return query select 'payment_mismatch'::text, p_order_id;
    return;
  end if;
  if v_order.payment_status::text = 'paid' or v_order.reservation_status = 'committed' then
    return query select 'invalid_transition'::text, p_order_id;
    return;
  end if;
  if v_order.reservation_status <> 'reserved' then
    return query select 'invalid_transition'::text, p_order_id;
    return;
  end if;

  perform p.id
  from public.products p
  join public.order_items oi on oi.product_id = p.id
  where oi.order_id = p_order_id
  order by p.id
  for update of p;

  for v_item in
    select oi.product_id, sum(oi.quantity)::integer as quantity
    from public.order_items oi
    where oi.order_id = p_order_id
    group by oi.product_id
    order by oi.product_id
  loop
    update public.products
    set stock_quantity = stock_quantity + v_item.quantity
    where id = v_item.product_id and stock_quantity is not null;
  end loop;

  if v_order.coupon_id is not null then
    perform id from public.coupons where id = v_order.coupon_id for update;
    update public.coupons
    set used_count = greatest(coalesce(used_count, 0) - 1, 0)
    where id = v_order.coupon_id;
  end if;

  update public.orders
  set status = 'cancelled', payment_status = 'failed', reservation_status = 'released',
      updated_at = now()
  where id = p_order_id;

  insert into public.order_status_history (order_id, status, notes, created_at)
  values (p_order_id, 'cancelled', left(coalesce(p_reason, 'Reservation released'), 500), now());

  return query select 'released'::text, p_order_id;
end;
$$;

create or replace function public.claim_checkout_outbox(p_limit integer default 10)
returns setof public.checkout_outbox
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.checkout_outbox
  set status = 'pending', locked_at = null, updated_at = now()
  where status = 'processing' and locked_at < now() - interval '5 minutes';

  return query
  with candidates as (
    select id
    from public.checkout_outbox
    where status = 'pending' and available_at <= now()
    order by created_at
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 10), 100))
  )
  update public.checkout_outbox o
  set status = 'processing', locked_at = now(),
      attempt_count = o.attempt_count + 1, updated_at = now()
  from candidates c
  where o.id = c.id
  returning o.*;
end;
$$;

create or replace function public.complete_checkout_outbox(
  p_id uuid,
  p_success boolean,
  p_error text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.checkout_outbox
  set status = case
        when p_success then 'delivered'
        when attempt_count >= 8 then 'failed'
        else 'pending'
      end,
      delivered_at = case when p_success then now() else delivered_at end,
      available_at = case
        when p_success then available_at
        else now() + make_interval(secs => least(3600, 15 * (2 ^ least(attempt_count, 8))::integer))
      end,
      locked_at = null,
      last_error = case when p_success then null else left(coalesce(p_error, 'unknown_error'), 1000) end,
      updated_at = now()
  where id = p_id and status = 'processing';
end;
$$;

revoke all on public.checkout_outbox from anon, authenticated;
revoke all on function public.create_checkout_draft(jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.create_and_finalize_paid_order(jsonb, jsonb, text, text, text) from public, anon, authenticated;
revoke all on function public.finalize_paid_order(uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.release_checkout_reservation(uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.claim_checkout_outbox(integer) from public, anon, authenticated;
revoke all on function public.complete_checkout_outbox(uuid, boolean, text) from public, anon, authenticated;

grant execute on function public.create_checkout_draft(jsonb, jsonb) to service_role;
grant execute on function public.create_and_finalize_paid_order(jsonb, jsonb, text, text, text) to service_role;
grant execute on function public.finalize_paid_order(uuid, text, text, text) to service_role;
grant execute on function public.release_checkout_reservation(uuid, text, text, text) to service_role;
grant execute on function public.claim_checkout_outbox(integer) to service_role;
grant execute on function public.complete_checkout_outbox(uuid, boolean, text) to service_role;
