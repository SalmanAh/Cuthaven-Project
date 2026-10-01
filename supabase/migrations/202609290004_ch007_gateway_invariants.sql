-- CH-007: one active gateway per provider, atomic activation, and audit trail.
-- Apply after 202609290003_ch005_secure_conversation_ownership.sql.

create table if not exists public.payment_gateway_audit (
  id uuid primary key default gen_random_uuid(),
  gateway_id uuid not null,
  actor_staff_id uuid references public.staff(id) on delete set null,
  action text not null check (action in ('created', 'updated', 'activated', 'deleted')),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.payment_gateway_audit enable row level security;
revoke all on public.payment_gateway_audit from public, anon, authenticated;
grant select, insert on public.payment_gateway_audit to service_role;

-- Normalize any pre-existing duplicate active rows before adding the invariant.
with ranked as (
  select id, row_number() over (
    partition by gateway_type order by updated_at desc, created_at desc, id
  ) as position
  from public.payment_gateways
  where is_active = true
)
update public.payment_gateways gateway
set is_active = false, updated_at = now()
from ranked
where gateway.id = ranked.id and ranked.position > 1;

create unique index if not exists payment_gateways_one_active_per_type
  on public.payment_gateways (gateway_type)
  where is_active = true;

create or replace function public.activate_payment_gateway(
  p_id uuid,
  p_actor_id uuid default null
)
returns setof public.payment_gateways
language plpgsql
security definer
set search_path = public
as $$
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

revoke all on function public.activate_payment_gateway(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.activate_payment_gateway(uuid, uuid) to service_role;
