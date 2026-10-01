-- Follow-up checkout integrity: bind provider accounts and serialize coupon identity use.

alter table public.orders
  add column if not exists payment_gateway_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'orders_payment_gateway_id_fkey'
      and conrelid = 'public.orders'::regclass
  ) then
    alter table public.orders
      add constraint orders_payment_gateway_id_fkey
      foreign key (payment_gateway_id)
      references public.payment_gateways(id)
      on delete restrict;
  end if;
end;
$$;

-- A historical order can be backfilled safely only when its provider has one
-- configured account. Multiple accounts are intentionally left unresolved for
-- operator/provider reconciliation rather than guessed from current activation.
update public.orders orders
set payment_gateway_id = gateway.only_id
from (
  select gateway_type, (array_agg(id order by created_at))[1] as only_id
  from public.payment_gateways
  group by gateway_type
  having count(*) = 1
) gateway
where orders.payment_gateway_id is null
  and gateway.gateway_type = orders.payment_processor;

create index if not exists orders_payment_gateway_id_idx
  on public.orders (payment_gateway_id);

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
  v_customer_id uuid;
  v_customer_email text;
  v_shipping_address jsonb;
  v_processor text;
  v_requested_gateway_id uuid;
  v_gateway_id uuid;
  v_item record;
  v_stock integer;
  v_coupon record;
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'cart_empty' using errcode = 'P0001';
  end if;

  v_customer_id := nullif(p_order->>'customer_id', '')::uuid;
  v_customer_email := lower(btrim(p_order->'shipping_address'->>'email'));
  v_shipping_address := p_order->'shipping_address';
  if nullif(v_customer_email, '') is not null then
    v_shipping_address := jsonb_set(v_shipping_address, '{email}', to_jsonb(v_customer_email), true);
  end if;

  v_processor := coalesce(nullif(p_order->>'payment_processor', ''), 'stripe');
  if v_processor not in ('stripe', 'paypal') then
    raise exception 'payment_processor_invalid' using errcode = 'P0001';
  end if;

  v_requested_gateway_id := nullif(p_order->>'payment_gateway_id', '')::uuid;
  select gateway.id into v_gateway_id
  from public.payment_gateways gateway
  where gateway.gateway_type = v_processor
    and (
      (v_requested_gateway_id is not null and gateway.id = v_requested_gateway_id) or
      (v_requested_gateway_id is null and gateway.is_active = true)
    )
  limit 1;

  if v_gateway_id is null then
    raise exception 'payment_gateway_unavailable' using errcode = 'P0001';
  end if;

  perform product.id
  from public.products product
  join (
    select item.product_id
    from jsonb_to_recordset(p_items) as item(product_id uuid, quantity integer)
    group by item.product_id
  ) requested on requested.product_id = product.id
  order by product.id
  for update of product;

  for v_item in
    select item.product_id, sum(item.quantity)::integer as quantity
    from jsonb_to_recordset(p_items) as item(product_id uuid, quantity integer)
    group by item.product_id
    order by item.product_id
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

    if v_customer_id is null and nullif(v_customer_email, '') is null then
      raise exception 'coupon_customer_identity_required' using errcode = 'P0001';
    end if;

    if exists (
      select 1
      from public.orders existing
      where existing.coupon_id = v_coupon_id
        and (
          (v_customer_id is not null and existing.customer_id = v_customer_id) or
          (v_customer_id is null and existing.customer_id is null and
            lower(btrim(existing.shipping_address->>'email')) = v_customer_email)
        )
        and (
          existing.reservation_status in ('reserved', 'committed') or
          existing.status in ('confirmed', 'processing', 'shipped', 'delivered')
        )
    ) then
      raise exception 'coupon_already_used' using errcode = 'P0001';
    end if;

    update public.coupons
    set used_count = coalesce(used_count, 0) + 1
    where id = v_coupon_id;
  end if;

  insert into public.orders (
    order_number, customer_id, status, payment_status,
    subtotal, shipping_cost, tax_amount, discount_amount, total,
    shipping_address, billing_address, payment_processor, payment_gateway_id,
    payment_transaction_id, customer_notes, coupon_id,
    confirmation_token_hash, reservation_status, reservation_expires_at
  ) values (
    p_order->>'order_number', v_customer_id,
    'pending', 'pending',
    (p_order->>'subtotal')::numeric, (p_order->>'shipping_cost')::numeric,
    (p_order->>'tax_amount')::numeric, (p_order->>'discount_amount')::numeric,
    (p_order->>'total')::numeric, v_shipping_address,
    v_shipping_address, v_processor, v_gateway_id,
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
    v_order_id, item.product_id, item.product_name, item.product_slug, item.product_image,
    item.quantity, item.unit_price, item.total_price
  from jsonb_to_recordset(p_items) as item(
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

revoke all on function public.create_checkout_draft(jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.create_checkout_draft(jsonb, jsonb) to service_role;
