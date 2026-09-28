-- CH-002: persist an order before exposing a Stripe PaymentIntent to a customer.
-- Apply this migration before deploying the corresponding backend/frontend code.

alter table public.orders
  add column if not exists confirmation_token_hash text;

create unique index if not exists orders_provider_transaction_unique
  on public.orders (payment_processor, payment_transaction_id)
  where payment_transaction_id is not null;

create unique index if not exists orders_confirmation_token_hash_unique
  on public.orders (confirmation_token_hash)
  where confirmation_token_hash is not null;

create index if not exists orders_pending_stripe_created_at_idx
  on public.orders (created_at)
  where payment_processor = 'stripe' and payment_status = 'pending';

comment on column public.orders.confirmation_token_hash is
  'SHA-256 hash of the one-time guest order access token; never store the raw token.';
