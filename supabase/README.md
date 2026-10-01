# Database migrations

Fresh Supabase projects apply every file in `migrations/` in filename order. The
`202609270000` baseline is schema-only and contains no application rows or
credentials; later migrations are intentionally replay-safe over that snapshot.

## Existing production project

Do not execute the baseline against an existing project. First compare the
linked migration history with `supabase migration list`. Only after confirming
that the live objects match the reviewed files, mark the manually installed
versions as applied:

```bash
supabase migration repair 202609270000 202609280001 202609290001 \
  202609290002 202609290003 202609290004 --status applied --linked
supabase db push --dry-run --linked
```

Review the dry run before applying the remaining `202609290005` storage-bucket
migration and `202610010001` follow-up checkout-integrity migration in filename
order. `migration repair` changes migration history only; it does not run
or revert schema SQL. Never use `db reset --linked` on production.

The follow-up migration backfills `payment_gateway_id` only when a provider has
exactly one configured account. Before deploying the matching backend, resolve
any ambiguous pending rows against the provider dashboard:

```sql
select id, order_number, payment_processor, payment_transaction_id, payment_provider_order_id
from public.orders
where payment_status = 'pending' and payment_gateway_id is null;
```
