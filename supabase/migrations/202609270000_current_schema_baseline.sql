--
-- PostgreSQL database dump
--

-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.6 (Ubuntu 18.6-1.pgdg24.04+2)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA IF NOT EXISTS public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: payment_gateways; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_gateways (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    gateway_type text NOT NULL,
    account_name text NOT NULL,
    is_active boolean DEFAULT false NOT NULL,
    stripe_secret_key text,
    stripe_publishable_key text,
    stripe_webhook_secret text,
    paypal_client_id text,
    paypal_client_secret text,
    paypal_mode text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    CONSTRAINT payment_gateways_gateway_type_check CHECK ((gateway_type = ANY (ARRAY['stripe'::text, 'paypal'::text]))),
    CONSTRAINT payment_gateways_paypal_mode_check CHECK ((paypal_mode = ANY (ARRAY['sandbox'::text, 'live'::text, NULL::text])))
);


--
-- Name: activate_payment_gateway(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.activate_payment_gateway(p_id uuid, p_actor_id uuid DEFAULT NULL::uuid) RETURNS SETOF public.payment_gateways
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_gateway public.payment_gateways%rowtype;
begin
  select * into v_gateway from public.payment_gateways where id = p_id;
  if not found then
    return;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('payment_gateway:' || v_gateway.gateway_type::text, 0)
  );

  select * into v_gateway from public.payment_gateways where id = p_id for update;
  if (v_gateway.gateway_type::text = 'stripe' and (
      v_gateway.stripe_secret_key is null or
      v_gateway.stripe_publishable_key is null or
      v_gateway.stripe_webhook_secret is null
    )) or (v_gateway.gateway_type::text = 'paypal' and (
      v_gateway.paypal_client_id is null or
      v_gateway.paypal_client_secret is null or
      v_gateway.paypal_mode is null
    )) then
    raise exception 'gateway_credentials_incomplete' using errcode = 'P0001';
  end if;

  update public.payment_gateways
  set is_active = false, updated_at = now()
  where gateway_type = v_gateway.gateway_type and id <> p_id and is_active = true;

  update public.payment_gateways
  set is_active = true, updated_at = now()
  where id = p_id
  returning * into v_gateway;

  insert into public.payment_gateway_audit (gateway_id, actor_staff_id, action)
  values (p_id, p_actor_id, 'activated');

  return next v_gateway;
end;
$$;


--
-- Name: checkout_outbox; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.checkout_outbox (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_key text NOT NULL,
    event_type text NOT NULL,
    aggregate_id uuid NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    attempt_count integer DEFAULT 0 NOT NULL,
    available_at timestamp with time zone DEFAULT now() NOT NULL,
    locked_at timestamp with time zone,
    last_error text,
    delivered_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT checkout_outbox_attempt_count_check CHECK ((attempt_count >= 0)),
    CONSTRAINT checkout_outbox_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'delivered'::text, 'failed'::text])))
);


--
-- Name: claim_checkout_outbox(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.claim_checkout_outbox(p_limit integer DEFAULT 10) RETURNS SETOF public.checkout_outbox
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


--
-- Name: complete_checkout_outbox(uuid, boolean, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.complete_checkout_outbox(p_id uuid, p_success boolean, p_error text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


--
-- Name: create_and_finalize_paid_order(jsonb, jsonb, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_and_finalize_paid_order(p_order jsonb, p_items jsonb, p_provider text, p_transaction_id text, p_provider_event_id text) RETURNS TABLE(outcome text, order_id uuid)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


--
-- Name: create_checkout_draft(jsonb, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_checkout_draft(p_order jsonb, p_items jsonb) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


--
-- Name: decrement_product_stock(uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.decrement_product_stock(product_id uuid, quantity integer) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  UPDATE products
  SET
    stock_quantity = GREATEST(0, stock_quantity - quantity),
    updated_at = NOW()
  WHERE id = product_id;

  -- If stock becomes 0 or negative, mark as out of stock
  UPDATE products
  SET availability = 'out_of_stock'
  WHERE id = product_id AND stock_quantity <= 0;
END;
$$;


--
-- Name: enforce_single_active_gateway(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enforce_single_active_gateway() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  -- If setting this gateway to active, deactivate all others of the same type
  IF NEW.is_active = true THEN
    UPDATE payment_gateways
    SET is_active = false, updated_at = NOW()
    WHERE gateway_type = NEW.gateway_type
      AND id != NEW.id
      AND is_active = true;
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: finalize_paid_order(uuid, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.finalize_paid_order(p_order_id uuid, p_provider text, p_transaction_id text, p_provider_event_id text) RETURNS TABLE(outcome text, order_id uuid)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


--
-- Name: finalize_paypal_capture(uuid, text, text, text, bigint, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.finalize_paypal_capture(p_order_id uuid, p_paypal_order_id text, p_capture_id text, p_currency text, p_amount_cents bigint, p_reference_id text, p_provider_event_id text) RETURNS TABLE(outcome text, order_id uuid)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


--
-- Name: generate_order_number(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_order_number() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.order_number := 'CUT-' || to_char(now(), 'YYYY') || '-' ||
                      LPAD(nextval('order_number_seq')::text, 5, '0');
  RETURN NEW;
END;
$$;


--
-- Name: get_admin_unread_count(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_admin_unread_count() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  total_unread INTEGER;
BEGIN
  SELECT COALESCE(SUM(unread_by_admin), 0)
  INTO total_unread
  FROM customer_conversations;

  RETURN total_unread;
END;
$$;


--
-- Name: get_customer_unread_count(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_customer_unread_count(user_id uuid DEFAULT NULL::uuid, email text DEFAULT NULL::text) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  total_unread INTEGER;
BEGIN
  SELECT COALESCE(SUM(unread_by_customer), 0)
  INTO total_unread
  FROM customer_conversations
  WHERE
    (user_id IS NOT NULL AND customer_id = user_id) OR
    (email IS NOT NULL AND guest_email = email);

  RETURN total_unread;
END;
$$;


--
-- Name: has_role(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_role(p_user_id uuid, p_role text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = p_user_id AND role = p_role
  );
$$;


--
-- Name: increment_coupon_usage(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.increment_coupon_usage(coupon_id uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
  UPDATE coupons
  SET used_count = used_count + 1, updated_at = NOW()
  WHERE id = coupon_id AND is_active = true
    AND (max_uses IS NULL OR used_count < max_uses);
  IF NOT FOUND THEN RAISE EXCEPTION 'coupon_exhausted'; END IF;
END;
$$;


--
-- Name: link_paypal_order(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.link_paypal_order(p_order_id uuid, p_paypal_order_id text) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


--
-- Name: mark_conversation_read(uuid, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.mark_conversation_read(conv_id uuid, reader_is_admin boolean DEFAULT false) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  IF reader_is_admin THEN
    UPDATE customer_conversations
    SET unread_by_admin = 0, updated_at = NOW()
    WHERE id = conv_id;
  ELSE
    UPDATE customer_conversations
    SET unread_by_customer = 0, updated_at = NOW()
    WHERE id = conv_id;
  END IF;
END;
$$;


--
-- Name: release_checkout_reservation(uuid, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.release_checkout_reservation(p_order_id uuid, p_reason text, p_provider text DEFAULT NULL::text, p_transaction_id text DEFAULT NULL::text) RETURNS TABLE(outcome text, order_id uuid)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


--
-- Name: update_conversation_timestamp(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_conversation_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  UPDATE customer_conversations
  SET
    last_message_at = NEW.created_at,
    updated_at = NOW(),
    -- Increment unread count based on who sent the message
    unread_by_customer = CASE WHEN NEW.is_admin = TRUE THEN unread_by_customer + 1 ELSE unread_by_customer END,
    unread_by_admin = CASE WHEN NEW.is_admin = FALSE THEN unread_by_admin + 1 ELSE unread_by_admin END
  WHERE id = NEW.conversation_id;

  RETURN NEW;
END;
$$;


--
-- Name: update_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: blog_posts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.blog_posts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug text NOT NULL,
    title text NOT NULL,
    excerpt text NOT NULL,
    content text NOT NULL,
    category text DEFAULT 'General'::text NOT NULL,
    author text DEFAULT 'CutHaven Team'::text NOT NULL,
    image_url text,
    read_time text DEFAULT '5 min read'::text,
    is_published boolean DEFAULT false,
    published_at timestamp with time zone,
    meta_title text,
    meta_description text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: carts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.carts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    customer_id uuid,
    session_id text,
    items jsonb DEFAULT '[]'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug text NOT NULL,
    name text NOT NULL,
    google_product_category text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: consent_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.consent_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    customer_id uuid,
    session_id text,
    consent_action text NOT NULL,
    gpc_signal_detected boolean DEFAULT false,
    privacy_policy_version text NOT NULL,
    consent_details jsonb,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT consent_log_consent_action_check CHECK ((consent_action = ANY (ARRAY['accept_all'::text, 'reject_all'::text, 'custom'::text, 'opt_out_sale_share'::text, 'limit_sensitive_pi'::text])))
);


--
-- Name: contact_submissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contact_submissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    phone text,
    subject text,
    message text NOT NULL,
    status text DEFAULT 'new'::text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT contact_submissions_status_check CHECK ((status = ANY (ARRAY['new'::text, 'read'::text, 'replied'::text, 'archived'::text])))
);


--
-- Name: conversation_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conversation_messages (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    conversation_id uuid NOT NULL,
    is_admin boolean DEFAULT false,
    sender_id uuid,
    message text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT message_length CHECK ((length(message) <= 5000)),
    CONSTRAINT message_not_empty CHECK ((length(TRIM(BOTH FROM message)) > 0))
);


--
-- Name: TABLE conversation_messages; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.conversation_messages IS 'Individual messages within conversations';


--
-- Name: COLUMN conversation_messages.is_admin; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.conversation_messages.is_admin IS 'TRUE if message sent by admin, FALSE if sent by customer';


--
-- Name: coupons; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.coupons (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    discount_type text NOT NULL,
    discount_value numeric NOT NULL,
    min_order_amount numeric DEFAULT 0,
    max_uses integer,
    used_count integer DEFAULT 0,
    valid_from timestamp with time zone DEFAULT now(),
    valid_until timestamp with time zone,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT coupons_discount_type_check CHECK ((discount_type = ANY (ARRAY['percentage'::text, 'fixed'::text]))),
    CONSTRAINT coupons_discount_value_check CHECK ((discount_value > (0)::numeric)),
    CONSTRAINT coupons_min_order_amount_check CHECK ((min_order_amount >= (0)::numeric)),
    CONSTRAINT coupons_used_count_check CHECK ((used_count >= 0))
);


--
-- Name: customer_conversations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customer_conversations (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    customer_id uuid,
    guest_email text,
    guest_name text,
    last_message_at timestamp with time zone DEFAULT now(),
    unread_by_customer integer DEFAULT 0,
    unread_by_admin integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT valid_customer CHECK ((((customer_id IS NOT NULL) AND (guest_email IS NULL) AND (guest_name IS NULL)) OR ((customer_id IS NULL) AND (guest_email IS NOT NULL) AND (guest_name IS NOT NULL)))),
    CONSTRAINT valid_email CHECK (((guest_email IS NULL) OR (guest_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'::text)))
);


--
-- Name: TABLE customer_conversations; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.customer_conversations IS 'Stores Q&A conversation threads between customers (logged-in or guest) and admin';


--
-- Name: COLUMN customer_conversations.unread_by_customer; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.customer_conversations.unread_by_customer IS 'Count of admin messages customer has not read yet (for badge)';


--
-- Name: COLUMN customer_conversations.unread_by_admin; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.customer_conversations.unread_by_admin IS 'Count of customer messages admin has not read yet (for badge)';


--
-- Name: customers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    auth_id uuid,
    email text NOT NULL,
    phone text,
    first_name text NOT NULL,
    last_name text NOT NULL,
    addresses jsonb DEFAULT '[]'::jsonb,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: feed_sync_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.feed_sync_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id uuid NOT NULL,
    sync_status text NOT NULL,
    google_item_id text,
    error_code text,
    error_message text,
    synced_at timestamp with time zone DEFAULT now(),
    CONSTRAINT feed_sync_log_sync_status_check CHECK ((sync_status = ANY (ARRAY['pending'::text, 'synced'::text, 'error'::text, 'disapproved'::text])))
);


--
-- Name: order_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid,
    product_id uuid,
    product_name text NOT NULL,
    product_slug text NOT NULL,
    product_image text,
    quantity integer NOT NULL,
    unit_price numeric NOT NULL,
    total_price numeric NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT order_items_quantity_check CHECK ((quantity > 0)),
    CONSTRAINT order_items_total_price_check CHECK ((total_price >= (0)::numeric)),
    CONSTRAINT order_items_unit_price_check CHECK ((unit_price >= (0)::numeric))
);


--
-- Name: order_number_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.order_number_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: order_status_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_status_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid,
    status text NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_number text NOT NULL,
    customer_id uuid,
    status text DEFAULT 'pending'::text NOT NULL,
    subtotal numeric NOT NULL,
    shipping_cost numeric DEFAULT 0,
    tax_amount numeric DEFAULT 0,
    discount_amount numeric DEFAULT 0,
    total numeric NOT NULL,
    coupon_id uuid,
    shipping_address jsonb NOT NULL,
    billing_address jsonb,
    payment_processor text NOT NULL,
    payment_method text,
    payment_status text DEFAULT 'pending'::text,
    payment_transaction_id text,
    customer_notes text,
    admin_notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    confirmation_token_hash text,
    reservation_status text DEFAULT 'none'::text NOT NULL,
    reservation_expires_at timestamp with time zone,
    finalized_at timestamp with time zone,
    payment_provider_order_id text,
    CONSTRAINT orders_discount_amount_check CHECK ((discount_amount >= (0)::numeric)),
    CONSTRAINT orders_payment_method_check CHECK ((payment_method = ANY (ARRAY['card'::text, 'paypal_balance'::text]))),
    CONSTRAINT orders_payment_processor_check CHECK ((payment_processor = ANY (ARRAY['stripe'::text, 'paypal'::text]))),
    CONSTRAINT orders_payment_status_check CHECK ((payment_status = ANY (ARRAY['pending'::text, 'paid'::text, 'failed'::text, 'refunded'::text, 'partially_refunded'::text]))),
    CONSTRAINT orders_reservation_status_check CHECK ((reservation_status = ANY (ARRAY['none'::text, 'reserved'::text, 'committed'::text, 'released'::text]))),
    CONSTRAINT orders_shipping_cost_check CHECK ((shipping_cost >= (0)::numeric)),
    CONSTRAINT orders_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'confirmed'::text, 'processing'::text, 'shipped'::text, 'delivered'::text, 'cancelled'::text, 'refunded'::text]))),
    CONSTRAINT orders_subtotal_check CHECK ((subtotal >= (0)::numeric)),
    CONSTRAINT orders_tax_amount_check CHECK ((tax_amount >= (0)::numeric)),
    CONSTRAINT orders_total_check CHECK ((total >= (0)::numeric))
);


--
-- Name: COLUMN orders.confirmation_token_hash; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.orders.confirmation_token_hash IS 'SHA-256 hash of the one-time guest order access token; never store the raw token.';


--
-- Name: payment_gateway_audit; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_gateway_audit (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    gateway_id uuid NOT NULL,
    actor_staff_id uuid,
    action text NOT NULL,
    details jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT payment_gateway_audit_action_check CHECK ((action = ANY (ARRAY['created'::text, 'updated'::text, 'activated'::text, 'deleted'::text])))
);


--
-- Name: products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.products (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug text NOT NULL,
    name text NOT NULL,
    tagline text,
    short_description text,
    description text NOT NULL,
    price numeric NOT NULL,
    compare_at_price numeric,
    currency text DEFAULT 'USD'::text NOT NULL,
    sku text,
    brand text,
    gtin text,
    mpn text,
    identifier_exists boolean DEFAULT true,
    condition text DEFAULT 'new'::text NOT NULL,
    google_product_category text,
    category_id uuid,
    item_group_id uuid,
    variant_attributes jsonb,
    availability text DEFAULT 'in_stock'::text NOT NULL,
    availability_date date,
    stock_quantity integer DEFAULT 0,
    low_stock_threshold integer DEFAULT 10,
    weight_kg numeric,
    length_cm numeric,
    width_cm numeric,
    height_cm numeric,
    primary_image_url text NOT NULL,
    image_urls text[] DEFAULT '{}'::text[],
    primary_image_width_px integer,
    primary_image_height_px integer,
    features text[] DEFAULT '{}'::text[],
    shipping_policy_id uuid,
    return_policy_id uuid,
    featured boolean DEFAULT false,
    is_active boolean DEFAULT true,
    meta_title text,
    meta_description text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT products_availability_check CHECK ((availability = ANY (ARRAY['in_stock'::text, 'out_of_stock'::text, 'preorder'::text, 'backorder'::text]))),
    CONSTRAINT products_compare_at_price_check CHECK ((compare_at_price >= (0)::numeric)),
    CONSTRAINT products_condition_check CHECK ((condition = ANY (ARRAY['new'::text, 'used'::text, 'refurbished'::text]))),
    CONSTRAINT products_price_check CHECK ((price >= (0)::numeric)),
    CONSTRAINT products_stock_quantity_check CHECK ((stock_quantity >= 0))
);


--
-- Name: return_policies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.return_policies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    applicable_country text DEFAULT 'US'::text NOT NULL,
    return_policy_category text NOT NULL,
    merchant_return_days integer,
    return_method text,
    return_fees text,
    refund_type text,
    policy_content text,
    is_default boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT return_policies_return_policy_category_check CHECK ((return_policy_category = ANY (ARRAY['MerchantReturnFiniteReturnWindow'::text, 'MerchantReturnUnlimitedWindow'::text, 'MerchantReturnNotPermitted'::text])))
);


--
-- Name: reviews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reviews (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id uuid,
    customer_id uuid,
    rating integer NOT NULL,
    review_text text,
    is_verified_purchase boolean DEFAULT false,
    is_approved boolean DEFAULT false,
    disclosed_incentive boolean DEFAULT false,
    insider_relationship text,
    image_urls text[] DEFAULT '{}'::text[],
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT reviews_rating_check CHECK (((rating >= 1) AND (rating <= 5)))
);


--
-- Name: shipping_policies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shipping_policies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    applicable_country text DEFAULT 'US'::text NOT NULL,
    handling_time_min_days integer NOT NULL,
    handling_time_max_days integer NOT NULL,
    transit_time_min_days integer NOT NULL,
    transit_time_max_days integer NOT NULL,
    shipping_rate numeric,
    shipping_rate_currency text DEFAULT 'USD'::text,
    free_shipping_threshold numeric,
    policy_content text,
    is_default boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT shipping_policies_free_shipping_threshold_check CHECK ((free_shipping_threshold >= (0)::numeric)),
    CONSTRAINT shipping_policies_shipping_rate_check CHECK ((shipping_rate >= (0)::numeric))
);


--
-- Name: staff; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.staff (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    auth_id uuid,
    email text NOT NULL,
    first_name text NOT NULL,
    last_name text NOT NULL,
    role text NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT staff_role_check CHECK ((role = ANY (ARRAY['admin'::text, 'store_manager'::text, 'product_manager'::text])))
);


--
-- Name: staff_audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.staff_audit_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    staff_id uuid,
    action text NOT NULL,
    entity_type text NOT NULL,
    entity_id uuid,
    changes jsonb,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: blog_posts blog_posts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blog_posts
    ADD CONSTRAINT blog_posts_pkey PRIMARY KEY (id);


--
-- Name: blog_posts blog_posts_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blog_posts
    ADD CONSTRAINT blog_posts_slug_key UNIQUE (slug);


--
-- Name: carts carts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.carts
    ADD CONSTRAINT carts_pkey PRIMARY KEY (id);


--
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);


--
-- Name: categories categories_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_slug_key UNIQUE (slug);


--
-- Name: checkout_outbox checkout_outbox_event_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checkout_outbox
    ADD CONSTRAINT checkout_outbox_event_key_key UNIQUE (event_key);


--
-- Name: checkout_outbox checkout_outbox_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checkout_outbox
    ADD CONSTRAINT checkout_outbox_pkey PRIMARY KEY (id);


--
-- Name: consent_log consent_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consent_log
    ADD CONSTRAINT consent_log_pkey PRIMARY KEY (id);


--
-- Name: contact_submissions contact_submissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_submissions
    ADD CONSTRAINT contact_submissions_pkey PRIMARY KEY (id);


--
-- Name: conversation_messages conversation_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_messages
    ADD CONSTRAINT conversation_messages_pkey PRIMARY KEY (id);


--
-- Name: coupons coupons_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coupons
    ADD CONSTRAINT coupons_code_key UNIQUE (code);


--
-- Name: coupons coupons_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coupons
    ADD CONSTRAINT coupons_pkey PRIMARY KEY (id);


--
-- Name: customer_conversations customer_conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_conversations
    ADD CONSTRAINT customer_conversations_pkey PRIMARY KEY (id);


--
-- Name: customers customers_auth_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_auth_id_key UNIQUE (auth_id);


--
-- Name: customers customers_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_email_key UNIQUE (email);


--
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (id);


--
-- Name: feed_sync_log feed_sync_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feed_sync_log
    ADD CONSTRAINT feed_sync_log_pkey PRIMARY KEY (id);


--
-- Name: order_items order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_pkey PRIMARY KEY (id);


--
-- Name: order_status_history order_status_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_status_history
    ADD CONSTRAINT order_status_history_pkey PRIMARY KEY (id);


--
-- Name: orders orders_order_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_order_number_key UNIQUE (order_number);


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- Name: payment_gateway_audit payment_gateway_audit_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_gateway_audit
    ADD CONSTRAINT payment_gateway_audit_pkey PRIMARY KEY (id);


--
-- Name: payment_gateways payment_gateways_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_gateways
    ADD CONSTRAINT payment_gateways_pkey PRIMARY KEY (id);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: products products_sku_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_sku_key UNIQUE (sku);


--
-- Name: products products_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_slug_key UNIQUE (slug);


--
-- Name: return_policies return_policies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.return_policies
    ADD CONSTRAINT return_policies_pkey PRIMARY KEY (id);


--
-- Name: reviews reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_pkey PRIMARY KEY (id);


--
-- Name: shipping_policies shipping_policies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipping_policies
    ADD CONSTRAINT shipping_policies_pkey PRIMARY KEY (id);


--
-- Name: staff_audit_log staff_audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_audit_log
    ADD CONSTRAINT staff_audit_log_pkey PRIMARY KEY (id);


--
-- Name: staff staff_auth_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff
    ADD CONSTRAINT staff_auth_id_key UNIQUE (auth_id);


--
-- Name: staff staff_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff
    ADD CONSTRAINT staff_email_key UNIQUE (email);


--
-- Name: staff staff_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff
    ADD CONSTRAINT staff_pkey PRIMARY KEY (id);


--
-- Name: payment_gateways unique_account_name_per_type; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_gateways
    ADD CONSTRAINT unique_account_name_per_type UNIQUE (gateway_type, account_name);


--
-- Name: blog_posts_published_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX blog_posts_published_idx ON public.blog_posts USING btree (is_published, published_at DESC);


--
-- Name: blog_posts_slug_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX blog_posts_slug_idx ON public.blog_posts USING btree (slug);


--
-- Name: checkout_outbox_pending_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX checkout_outbox_pending_idx ON public.checkout_outbox USING btree (available_at, created_at) WHERE (status = 'pending'::text);


--
-- Name: idx_conversations_customer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conversations_customer_id ON public.customer_conversations USING btree (customer_id);


--
-- Name: idx_conversations_guest_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conversations_guest_email ON public.customer_conversations USING btree (guest_email);


--
-- Name: idx_conversations_last_message; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conversations_last_message ON public.customer_conversations USING btree (last_message_at DESC);


--
-- Name: idx_conversations_unread_admin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conversations_unread_admin ON public.customer_conversations USING btree (unread_by_admin) WHERE (unread_by_admin > 0);


--
-- Name: idx_messages_admin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_admin ON public.conversation_messages USING btree (is_admin);


--
-- Name: idx_messages_conversation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_conversation ON public.conversation_messages USING btree (conversation_id, created_at DESC);


--
-- Name: idx_messages_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_created ON public.conversation_messages USING btree (created_at DESC);


--
-- Name: idx_payment_gateways_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_gateways_active ON public.payment_gateways USING btree (gateway_type, is_active) WHERE (is_active = true);


--
-- Name: idx_payment_gateways_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_gateways_type ON public.payment_gateways USING btree (gateway_type);


--
-- Name: orders_confirmation_token_hash_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX orders_confirmation_token_hash_unique ON public.orders USING btree (confirmation_token_hash) WHERE (confirmation_token_hash IS NOT NULL);


--
-- Name: orders_pending_stripe_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX orders_pending_stripe_created_at_idx ON public.orders USING btree (created_at) WHERE ((payment_processor = 'stripe'::text) AND (payment_status = 'pending'::text));


--
-- Name: orders_provider_order_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX orders_provider_order_unique ON public.orders USING btree (payment_processor, payment_provider_order_id) WHERE (payment_provider_order_id IS NOT NULL);


--
-- Name: orders_provider_transaction_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX orders_provider_transaction_unique ON public.orders USING btree (payment_processor, payment_transaction_id) WHERE (payment_transaction_id IS NOT NULL);


--
-- Name: payment_gateways_one_active_per_type; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX payment_gateways_one_active_per_type ON public.payment_gateways USING btree (gateway_type) WHERE (is_active = true);


--
-- Name: payment_gateways ensure_single_active_gateway; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER ensure_single_active_gateway BEFORE INSERT OR UPDATE ON public.payment_gateways FOR EACH ROW WHEN ((new.is_active = true)) EXECUTE FUNCTION public.enforce_single_active_gateway();


--
-- Name: payment_gateways payment_gateways_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER payment_gateways_updated_at BEFORE UPDATE ON public.payment_gateways FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: conversation_messages trigger_update_conversation_timestamp; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_conversation_timestamp AFTER INSERT ON public.conversation_messages FOR EACH ROW EXECUTE FUNCTION public.update_conversation_timestamp();


--
-- Name: customer_conversations trigger_update_conversations_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_conversations_updated_at BEFORE UPDATE ON public.customer_conversations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: carts carts_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.carts
    ADD CONSTRAINT carts_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id);


--
-- Name: checkout_outbox checkout_outbox_aggregate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checkout_outbox
    ADD CONSTRAINT checkout_outbox_aggregate_id_fkey FOREIGN KEY (aggregate_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: consent_log consent_log_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consent_log
    ADD CONSTRAINT consent_log_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id);


--
-- Name: conversation_messages conversation_messages_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_messages
    ADD CONSTRAINT conversation_messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.customer_conversations(id) ON DELETE CASCADE;


--
-- Name: conversation_messages conversation_messages_sender_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_messages
    ADD CONSTRAINT conversation_messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: customer_conversations customer_conversations_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_conversations
    ADD CONSTRAINT customer_conversations_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: feed_sync_log feed_sync_log_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feed_sync_log
    ADD CONSTRAINT feed_sync_log_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: order_items order_items_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id);


--
-- Name: order_items order_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: order_status_history order_status_history_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_status_history
    ADD CONSTRAINT order_status_history_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id);


--
-- Name: orders orders_coupon_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_coupon_id_fkey FOREIGN KEY (coupon_id) REFERENCES public.coupons(id);


--
-- Name: orders orders_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id);


--
-- Name: payment_gateway_audit payment_gateway_audit_actor_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_gateway_audit
    ADD CONSTRAINT payment_gateway_audit_actor_staff_id_fkey FOREIGN KEY (actor_staff_id) REFERENCES public.staff(id) ON DELETE SET NULL;


--
-- Name: payment_gateways payment_gateways_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_gateways
    ADD CONSTRAINT payment_gateways_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.staff(id) ON DELETE SET NULL;


--
-- Name: products products_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id);


--
-- Name: products products_return_policy_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_return_policy_id_fkey FOREIGN KEY (return_policy_id) REFERENCES public.return_policies(id);


--
-- Name: products products_shipping_policy_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_shipping_policy_id_fkey FOREIGN KEY (shipping_policy_id) REFERENCES public.shipping_policies(id);


--
-- Name: reviews reviews_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id);


--
-- Name: reviews reviews_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: staff_audit_log staff_audit_log_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_audit_log
    ADD CONSTRAINT staff_audit_log_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.staff(id);


--
-- Name: conversation_messages Admins can send messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can send messages" ON public.conversation_messages FOR INSERT TO authenticated WITH CHECK (((EXISTS ( SELECT 1
   FROM auth.users
  WHERE ((users.id = auth.uid()) AND ((users.raw_user_meta_data ->> 'role'::text) = ANY (ARRAY['admin'::text, 'store_manager'::text, 'product_manager'::text]))))) AND (is_admin = true) AND (sender_id = auth.uid())));


--
-- Name: customer_conversations Admins can update conversations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update conversations" ON public.customer_conversations FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM auth.users
  WHERE ((users.id = auth.uid()) AND ((users.raw_user_meta_data ->> 'role'::text) = ANY (ARRAY['admin'::text, 'store_manager'::text, 'product_manager'::text])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM auth.users
  WHERE ((users.id = auth.uid()) AND ((users.raw_user_meta_data ->> 'role'::text) = ANY (ARRAY['admin'::text, 'store_manager'::text, 'product_manager'::text]))))));


--
-- Name: customer_conversations Admins can view all conversations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all conversations" ON public.customer_conversations FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM auth.users
  WHERE ((users.id = auth.uid()) AND ((users.raw_user_meta_data ->> 'role'::text) = ANY (ARRAY['admin'::text, 'store_manager'::text, 'product_manager'::text]))))));


--
-- Name: conversation_messages Admins can view all messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all messages" ON public.conversation_messages FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM auth.users
  WHERE ((users.id = auth.uid()) AND ((users.raw_user_meta_data ->> 'role'::text) = ANY (ARRAY['admin'::text, 'store_manager'::text, 'product_manager'::text]))))));


--
-- Name: customer_conversations Customers can create conversations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Customers can create conversations" ON public.customer_conversations FOR INSERT TO authenticated WITH CHECK ((customer_id = auth.uid()));


--
-- Name: customer_conversations Customers can mark own conversations as read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Customers can mark own conversations as read" ON public.customer_conversations FOR UPDATE TO authenticated USING ((customer_id = auth.uid())) WITH CHECK ((customer_id = auth.uid()));


--
-- Name: conversation_messages Customers can send messages in own conversations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Customers can send messages in own conversations" ON public.conversation_messages FOR INSERT TO authenticated WITH CHECK (((EXISTS ( SELECT 1
   FROM public.customer_conversations
  WHERE ((customer_conversations.id = conversation_messages.conversation_id) AND (customer_conversations.customer_id = auth.uid())))) AND (is_admin = false) AND (sender_id = auth.uid())));


--
-- Name: conversation_messages Customers can view own conversation messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Customers can view own conversation messages" ON public.conversation_messages FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.customer_conversations
  WHERE ((customer_conversations.id = conversation_messages.conversation_id) AND (customer_conversations.customer_id = auth.uid())))));


--
-- Name: customer_conversations Customers can view own conversations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Customers can view own conversations" ON public.customer_conversations FOR SELECT TO authenticated USING ((customer_id = auth.uid()));


--
-- Name: customer_conversations Guests can create conversations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Guests can create conversations" ON public.customer_conversations FOR INSERT TO anon WITH CHECK (((guest_email IS NOT NULL) AND (guest_name IS NOT NULL)));


--
-- Name: conversation_messages Guests can send messages in own conversations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Guests can send messages in own conversations" ON public.conversation_messages FOR INSERT TO anon WITH CHECK (((EXISTS ( SELECT 1
   FROM public.customer_conversations
  WHERE ((customer_conversations.id = conversation_messages.conversation_id) AND (customer_conversations.guest_email IS NOT NULL)))) AND (is_admin = false)));


--
-- Name: conversation_messages Guests can view own conversation messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Guests can view own conversation messages" ON public.conversation_messages FOR SELECT TO anon USING ((EXISTS ( SELECT 1
   FROM public.customer_conversations
  WHERE ((customer_conversations.id = conversation_messages.conversation_id) AND (customer_conversations.guest_email IS NOT NULL)))));


--
-- Name: customer_conversations Guests can view own conversations by email; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Guests can view own conversations by email" ON public.customer_conversations FOR SELECT TO anon USING ((guest_email IS NOT NULL));


--
-- Name: blog_posts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;

--
-- Name: blog_posts blog_posts: public read published; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "blog_posts: public read published" ON public.blog_posts FOR SELECT USING ((is_published = true));


--
-- Name: blog_posts blog_posts: staff read all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "blog_posts: staff read all" ON public.blog_posts FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.staff
  WHERE ((staff.auth_id = auth.uid()) AND (staff.is_active = true)))));


--
-- Name: carts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.carts ENABLE ROW LEVEL SECURITY;

--
-- Name: categories; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

--
-- Name: checkout_outbox; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.checkout_outbox ENABLE ROW LEVEL SECURITY;

--
-- Name: consent_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.consent_log ENABLE ROW LEVEL SECURITY;

--
-- Name: contact_submissions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.contact_submissions ENABLE ROW LEVEL SECURITY;

--
-- Name: conversation_messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.conversation_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: coupons; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

--
-- Name: customer_conversations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.customer_conversations ENABLE ROW LEVEL SECURITY;

--
-- Name: customers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

--
-- Name: feed_sync_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.feed_sync_log ENABLE ROW LEVEL SECURITY;

--
-- Name: order_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

--
-- Name: order_status_history; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;

--
-- Name: orders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

--
-- Name: payment_gateway_audit; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.payment_gateway_audit ENABLE ROW LEVEL SECURITY;

--
-- Name: payment_gateways; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.payment_gateways ENABLE ROW LEVEL SECURITY;

--
-- Name: payment_gateways payment_gateways_admin_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY payment_gateways_admin_read ON public.payment_gateways FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.staff
  WHERE ((staff.auth_id = auth.uid()) AND (staff.role = 'admin'::text) AND (staff.is_active = true)))));


--
-- Name: payment_gateways payment_gateways_service_role_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY payment_gateways_service_role_all ON public.payment_gateways TO service_role USING (true) WITH CHECK (true);


--
-- Name: products; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

--
-- Name: return_policies; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.return_policies ENABLE ROW LEVEL SECURITY;

--
-- Name: reviews; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

--
-- Name: shipping_policies; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.shipping_policies ENABLE ROW LEVEL SECURITY;

--
-- Name: staff; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;

--
-- Name: staff_audit_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.staff_audit_log ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--
