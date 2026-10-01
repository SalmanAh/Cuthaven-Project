# CutHaven Defect Remediation Plan

**Purpose:** Detailed implementation and tracking plan for confirmed defects and release risks  
**Code review baseline:** `main` at `bcd5df5`  
**Created:** 2026-09-28  
**Last updated:** 2026-10-01
**Current release decision:** **BLOCKED for live payments and production customer data**  
**Primary project reference:** [README.md](README.md)

This document is a working remediation tracker. It describes what is wrong, why it happens in the current code, the chosen target design, affected files, database work, tests, acceptance criteria, sequencing, and rollback considerations. Update status and evidence here as work is completed; do not mark a defect complete merely because code was written.

No secrets, customer data, real payment identifiers, or private infrastructure details belong in this document.

## 1. Tracking conventions

### Status values

| Status | Meaning |
|---|---|
| `CONFIRMED` | Reproduced or directly established from current code |
| `DESIGN APPROVED` | Target solution agreed; implementation not started |
| `IN PROGRESS` | Code or migration work underway |
| `PENDING` | Intentionally waiting for named input before work can continue |
| `CODE COMPLETE` | Implementation finished; verification remains |
| `VERIFIED` | Automated and manual acceptance criteria passed |
| `DEFERRED` | Explicitly accepted for a later release with rationale |
| `BLOCKED` | Cannot proceed without a named dependency or decision |

### Priority values

| Priority | Meaning |
|---|---|
| `P0` | Can lose money, create paid-but-missing orders, expose customer data, or corrupt commerce state; blocks launch |
| `P1` | Serious release-quality, reproducibility, or security weakness; resolve before production acceptance |
| `P2` | Defense-in-depth or maintainability work; schedule after P0/P1 unless touched by related work |

### Completion rule

A defect becomes `VERIFIED` only when all of the following are true:

- The implementation and any database migration are reviewed.
- Automated tests covering the stated failure mode pass.
- The acceptance criteria in this document pass in a staging environment.
- Observability exists for the repaired behavior.
- A rollback/recovery procedure is documented and exercised where data or payments are involved.
- The README and this tracker describe the implemented behavior accurately.

## 2. Executive defect register

| ID | Priority | Status | Defect | Release gate |
|---|---|---|---|---|
| CH-001 | P0 | CODE COMPLETE | Stripe webhook loses the raw body before signature verification | Payments |
| CH-002 | P0 | CODE COMPLETE | Stripe can succeed without a database order; redirect fallback is invalid | Payments |
| CH-003 | P0 | CODE COMPLETE | Order finalization, stock, coupon, history, and email are not atomic/idempotent | Payments |
| CH-004 | P0 | CODE COMPLETE | PayPal capture trusts browser-returned order data and omits stock deduction | Payments |
| CH-005 | P0 | CODE COMPLETE | Customer-support routes do not enforce customer/guest ownership | Privacy |
| CH-006 | P0 | CODE COMPLETE | Public order summary exposes full order data by UUID | Privacy |
| CH-007 | P1 | CODE COMPLETE | Gateway activation and Stripe instance caching can select stale/ambiguous credentials | Configuration |
| CH-008 | P1 | CODE COMPLETE | “Anon” auth client uses the service-role key | Least privilege |
| CH-009 | P1 | CODE COMPLETE | Refresh tokens are stored in `localStorage`; frontend CSP is incomplete | Session security |
| CH-010 | P1 | CODE COMPLETE | Complete database migrations and RPC definitions are absent from version control | Reproducibility |
| CH-011 | P1 | IN PROGRESS | No automated tests or CI release gate exists | Quality |
| CH-012 | P1 | CODE COMPLETE | Frontend lint fails with 190 errors and 18 warnings | Quality |
| CH-013 | P1 | PENDING | Documented VPS frontend start command does not match the current build target | Deployment |
| CH-014 | P2 | CODE COMPLETE | Stale comments, deprecated endpoints/config, and public operational status create drift | Maintainability |
| CH-015 | P0 | CODE COMPLETE | Stripe failure webhook releases a retryable PaymentIntent reservation | Payments |
| CH-016 | P0 | CODE COMPLETE | PayPal reconciliation releases `APPROVED` orders that remain capturable | Payments |
| CH-017 | P0 | CODE COMPLETE | Pending orders are not bound to the provider account that created them | Payments |
| CH-018 | P1 | CODE COMPLETE | Successful anonymous checkout creation can exhaust reserved inventory | Availability |
| CH-019 | P1 | VERIFIED | Per-customer/email coupon uniqueness is outside the reservation transaction | Commerce integrity |
| CH-020 | P1 | CODE COMPLETE | Frontend TypeScript errors are not checked by build or CI | Quality |
| CH-021 | P1 | CODE COMPLETE | Backend lint command has no installed or configured linter | Quality |
| CH-022 | P2 | CODE COMPLETE | Production instructions and source comments reference a nonexistent legacy schema file | Maintainability |
| CH-023 | P1 | CODE COMPLETE | Backend production dependencies contain five known security advisories | Dependency security |

### Launch gate

Live checkout and production customer data remain blocked until:

- CH-001 through CH-006 are `VERIFIED`.
- CH-010 and CH-011 provide migrations and automated regression coverage for those fixes.
- CH-007 has a single-active-gateway invariant and credential refresh behavior.
- CH-015 through CH-021 and CH-023 are `VERIFIED` or have an explicitly accepted staging exception.
- A staging release passes the end-to-end matrix in Section 8.

## 3. Target architecture decisions

These decisions keep the remediation coherent. Implementing isolated patches without them would retain the underlying failure modes.

### 3.1 Server-owned checkout draft

Use the existing `orders` and `order_items` model to persist a pending order before returning a payment UI token. Do not use the browser or provider metadata as the order database.

Proposed lifecycle:

```text
validated cart
    |
    v
atomic create/reserve RPC
pending order + item snapshots + reservation expiry + guest token hash
    |
    +--> create Stripe PaymentIntent or PayPal order
    |        metadata/reference contains only internal order ID
    |
    v
provider confirms payment
    |
    v
single idempotent finalize_paid_order RPC
    |
    +--> paid/confirmed status
    +--> stock reservation committed exactly once
    +--> coupon reservation committed exactly once
    +--> status history exactly once
    +--> outbox event exactly once
             |
             v
       confirmation email worker/dispatcher
```

The browser confirmation endpoint and provider webhook may both request finalization, but both call the same idempotent service/RPC. Neither independently performs stock, coupon, or email side effects.

### 3.2 Inventory and coupon reservation

The current “check now, decrement after payment” flow can oversell under concurrency. The pending-order operation should reserve inventory atomically.

Recommended minimal model:

- Add `reservation_status`: `reserved`, `committed`, `released`.
- Add `reservation_expires_at`.
- During draft creation, lock affected products, confirm stock, and reserve/decrement once in the same transaction.
- Reserve coupon capacity in the same transaction when a coupon is used.
- On successful payment, commit the reservation without a second stock decrement.
- On provider failure, explicit cancellation, or expiration, release stock and coupon capacity exactly once.
- Add a scheduled reconciliation task for expired drafts.

If a separate `inventory_reservations` table is preferred, keep the same invariants. The key requirement is a database transaction and a unique reservation per order/item, not the exact table name.

### 3.3 Idempotent finalization and outbox

Required database invariants:

- Unique non-null provider transaction identity, preferably `(payment_processor, payment_transaction_id)`.
- One final order per pending order ID.
- A transition guard that allows `pending -> confirmed/paid` once.
- Stock and coupon operations record that they were committed/released.
- An outbox row uses a unique key such as `order.confirmed:<order_id>`.
- Email delivery claims the outbox event and records delivery/attempt state, preventing duplicate sends while allowing retry.

### 3.4 Customer and guest ownership

Authenticated identity must be derived from `req.user`; clients must not submit a trusted `customer_id`.

Guest access must use a high-entropy opaque token:

- Generate at least 32 random bytes server-side.
- Return the raw token once to the guest frontend.
- Store only a cryptographic hash in the database.
- Require it for all guest conversation reads/writes and guest order confirmation reads.
- Rotate/revoke where appropriate and compare safely.
- Do not treat email address, order UUID, conversation UUID, or provider ID as authorization.

For guest conversation recovery on another device, use a verified email magic link in a later phase. Do not restore access merely from a submitted email address.

### 3.5 Minimal response contracts

Replace `select("*")` on public/customer-facing endpoints with explicit fields and typed response mappers. Sensitive internal fields—provider IDs, billing data, coupon internals, customer IDs, notes not intended for display, token hashes, audit fields—must not leave the backend.

## 4. Implementation sequence and dependencies

```text
Phase 0: freeze + evidence + schema backup
  |
  v
Phase 1: migrations + app/test seams (CH-010, CH-011 foundation)
  |
  +------------------------+
  v                        v
Phase 2: payments          Phase 3: ownership/privacy
CH-001/002/003/004/007     CH-005/006
  |                        |
  +-----------+------------+
              v
Phase 4: auth/session hardening (CH-008/009)
              |
              v
Phase 5: lint/cleanup/deployment (CH-012/013/014)
              |
              v
Phase 6: staging, reconciliation drill, launch review
```

Do not fix CH-002 or CH-004 by adding more browser retries. Complete the pending-order and finalization foundation first.

### Phase 0 — safety and discovery

- [ ] Pause live payment activation until P0 items are verified.
- [ ] Export the live Supabase schema, functions, triggers, constraints, indexes, RLS policies, and storage configuration.
- [ ] Back up production/staging data before migrations.
- [ ] Record currently active gateway types and provider environments without copying secrets into tickets or logs.
- [ ] Reconcile any existing paid provider transactions that lack orders or have duplicate side effects.
- [ ] Decide whether Hostinger/Node or Cloudflare is the intended frontend production target.
- [ ] Establish staging accounts for Stripe, PayPal, Supabase, and Resend.

### Phase 1 — foundation

- [ ] Create `supabase/migrations/` with a reconciled baseline strategy.
- [ ] Add checkout-integrity, guest-token, and gateway-invariant migrations.
- [ ] Split Express app creation from `listen()` so Supertest can import the app.
- [ ] Add provider adapters/interfaces so Stripe and PayPal can be faked in tests.
- [ ] Add Vitest/Supertest backend testing and a CI workflow.
- [ ] Define typed checkout/order response contracts.

### Phase 2 — payment integrity

- [x] Implement CH-001; local verification passed, staging acceptance remains.
- [ ] Implement the pending-order/reservation model for CH-002/003.
- [ ] Move Stripe webhook and browser confirmation onto one finalizer.
- [ ] Rebuild PayPal around the same order draft/finalizer for CH-004.
- [x] Implement gateway invariants/cache invalidation from CH-007.
- [ ] Add reconciliation commands/jobs and observability.

### Phase 3 — ownership and privacy

- [ ] Implement central ownership helpers.
- [ ] Migrate conversations to account-derived identity or guest tokens.
- [ ] Protect order confirmation with account ownership or guest token.
- [ ] Remove PII from unrestricted responses and logs.

### Phase 4 — authentication hardening

- [ ] Add the anon-key configuration and correct Supabase client separation.
- [ ] Move refresh token to an HTTP-only cookie with CSRF/origin protection.
- [ ] Add a frontend Content Security Policy compatible with required providers.

### Phase 5 — quality and deployment

- [ ] Clear lint in staged batches.
- [ ] Lock the frontend package manager.
- [ ] Configure and test the chosen frontend production runtime.
- [ ] Remove deprecated endpoints/env fields and stale comments.

## 5. Detailed defect plans

## CH-001 — Stripe webhook raw body is parsed incorrectly

**Priority:** P0  
**Status:** CODE COMPLETE
**Dependencies:** Test harness from CH-011  
**Affected paths:** `backend/src/app.ts`, `backend/src/index.ts`, `backend/src/routes/checkout.routes.ts`, `backend/src/controllers/checkout.controller.ts`, `backend/src/middleware/errorHandler.ts`, `backend/test/webhook-body.test.mjs`, `backend/package.json`

### Original defect evidence

- `backend/src/index.ts:61-71` installs `express.json()` before mounting `/api`.
- `backend/src/routes/checkout.routes.ts:13-14` installs `express.raw()` inside the later checkout router.
- `backend/src/controllers/checkout.controller.ts:372-379` passes `req.body` to `stripe.webhooks.constructEvent()`.

Once JSON parsing consumes `application/json`, the handler no longer has the exact bytes Stripe signed.

### Implementation evidence — 2026-09-28

- `createApp()` now mounts `POST /api/checkout/webhook` with a route-scoped 1 MiB `express.raw()` parser before the global JSON parser.
- The later duplicate webhook registration was removed from `checkout.routes.ts`; all other checkout routes remain under the normal API router.
- The controller rejects non-Buffer bodies and missing/ambiguous signature headers before credential lookup or side effects.
- Verification and processing logs correlate the non-sensitive event ID, event type, gateway ID, and result without logging request bodies, signatures, or secrets.
- Oversized raw or JSON bodies now return HTTP 413 through the global error handler.
- App construction is separated from `listen()` so middleware ordering can be tested without starting the production entry point.

### Impact

- Legitimate webhook events can receive HTTP 400.
- Payment success/failure recovery does not run.
- Retried provider events increase noise without repairing state.

### Solution

1. Mount the webhook endpoint before `express.json()` at the application level, or mount a dedicated webhook router before JSON middleware.
2. Apply `express.raw({ type: "application/json", limit: <small explicit limit> })` only to that route.
3. Remove the second raw parser from `checkout.routes.ts` so there is one unambiguous registration.
4. Validate that `req.body` is a `Buffer` and `stripe-signature` is a single string.
5. Keep signature verification mandatory; never provide an unsigned development bypass.
6. Add structured logging for event ID, event type, gateway ID, HTTP result, and processing state without logging body, signature, or secrets.

Suggested structure:

```text
createApp()
  -> security/CORS/compression
  -> POST /api/checkout/webhook with express.raw()
  -> express.json()
  -> /api router
  -> error handler
```

### Tests

- [x] Valid generated Stripe signature over raw bytes returns 200.
- [x] Same JSON reserialized or altered returns 400.
- [x] Missing signature returns 400.
- [x] Wrong signing secret returns 400 and the test handler records no accepted event.
- [x] Normal JSON API endpoints still receive parsed objects.
- [x] Oversized webhook payload returns 413 before verification.

Local verification evidence (2026-09-28): `npm test` built the backend and passed 7/7 Node integration tests; `npm run typecheck` passed with zero diagnostics. `npm run lint` could not execute because the backend does not currently install an ESLint binary; this belongs to the CH-011 quality-tooling work and is not counted as a passing check.

### Acceptance criteria

- [ ] Stripe test event receives 2xx in staging.
- [ ] Invalid-signature event changes no order state.
- [ ] Application log includes event correlation but no sensitive payload.
- [ ] Automated raw-body regression test passes in CI.

### Rollback

Revert route mounting only if no live endpoint is receiving traffic. If production is active, maintain a maintenance/payment pause while correcting routing; never disable signature verification as rollback.

## CH-002 — Paid Stripe transaction can exist without an order

**Priority:** P0  
**Status:** CODE COMPLETE
**Dependencies:** CH-001, CH-003, CH-010  
**Affected paths:** `backend/src/controllers/checkout.controller.ts`, `backend/src/routes/checkout.routes.ts`, `backend/src/services/stripeCheckout.service.ts`, `backend/test/stripe-checkout-ordering.test.mjs`, `frontend/src/lib/api-client.ts`, `frontend/src/routes/checkout.tsx`, `frontend/src/routes/order-confirmation.tsx`, `supabase/migrations/202609280001_ch002_pending_stripe_orders.sql`, `.gitignore`

### Original defect evidence

- `createPaymentIntent()` creates no order and stores the draft in provider metadata.
- `confirmStripeOrder()` creates the order only after the browser reports success.
- The webhook searches for an existing `payment_transaction_id` and only updates it; it never inserts a missing order.
- `frontend/src/routes/checkout.tsx:592-601` catches confirmation failure and navigates using the PaymentIntent ID as `orderId`.
- `frontend/src/routes/order-confirmation.tsx` expects a database order ID, so that fallback cannot retrieve an order.
- `return_url` uses `piid`, but the confirmation route validates only `orderId`; redirect-based payment methods can land on the generic page.
- The confirmation page clears the cart on mount even when no confirmed order was loaded.

### Implementation evidence — 2026-09-29

- The backend persists a complete pending Supabase order and item snapshots before creating or exposing a Stripe PaymentIntent.
- Stripe metadata now contains only `orderId`; customer, address, totals, coupon, and line-item drafts are no longer stored in provider metadata.
- PaymentIntent creation uses the Supabase order ID as its Stripe idempotency key; a link failure cancels the unexposed intent and marks the draft failed.
- Signed webhooks require both the internal order ID and provider transaction ID, transition only pending payments, acknowledge true duplicates, and fail unmatched events so Stripe retries.
- Browser confirmation accepts only an internal UUID and verifies the provider ID read from the database; it no longer creates an order from Stripe metadata.
- Guest order reads require a 32-byte opaque token whose SHA-256 hash is stored in Supabase; authenticated reads require customer ownership.
- Redirects and fallback navigation use the internal order ID. The confirmation page polls for at most 60 seconds and clears the cart only after `confirmed` plus `paid` is returned.
- The migration adds the token-hash column, unique provider-transaction mapping, and pending-order lookup index. **Apply it before deploying this code.**

### Impact

- Money can be captured without an application order.
- Customer sees a generic confirmation while staff has no fulfillment record.
- Cart can be cleared despite unresolved payment/order creation.
- Manual reconciliation depends on provider logs.

### Solution

1. Create a pending database order and item snapshots before returning `clientSecret`.
2. Generate the database order ID/number and guest confirmation token server-side.
3. Put only the internal order ID in Stripe metadata.
4. Store the PaymentIntent ID on the pending order before returning to the browser.
5. Make the webhook the authoritative finalization trigger; the browser confirmation endpoint may accelerate/poll the same finalizer but must not implement separate effects.
6. Change Stripe `return_url` to include the internal order ID and guest confirmation token, not a PaymentIntent ID.
7. Make the confirmation page poll a safe order-status endpoint for a bounded period while webhook processing completes.
8. Clear the cart only after the server returns a confirmed/paid order associated with the current account or guest token.
9. Add a reconciliation job/command that queries unresolved pending orders against Stripe and finalizes or marks them failed.

### Proposed schema changes

Add or confirm:

- `orders.reservation_status`
- `orders.reservation_expires_at`
- `orders.finalized_at`
- `orders.confirmation_token_hash` for guests
- `orders.email_status` or an outbox table
- Unique `(payment_processor, payment_transaction_id)` where transaction ID is not null
- Unique `order_number`

### File-level work

- `backend/src/controllers/checkout.controller.ts`: split price/draft creation from provider creation; replace duplicate finalization logic.
- `backend/src/services/checkout.service.ts` (new): shared draft/finalize/reconcile orchestration.
- `backend/src/repositories/orders.repository.ts` (optional new seam): typed database operations.
- `backend/src/routes/checkout.routes.ts`: safe status/confirmation contract.
- `frontend/src/lib/api-client.ts`: return order ID plus guest token; remove `checkoutToken` ambiguity.
- `frontend/src/routes/checkout.tsx`: use internal order reference for redirects and confirmation.
- `frontend/src/routes/order-confirmation.tsx`: poll status, enforce token/auth, clear cart only after confirmation.

### Tests

- [ ] Browser closes immediately after successful payment; webhook creates/finalizes order.
- [ ] Browser confirmation arrives before webhook; later webhook is a no-op success.
- [ ] Webhook arrives before browser confirmation; browser receives existing result.
- [ ] Redirect payment returns through `return_url` and loads correct pending/confirmed order.
- [x] Database insert fails before PaymentIntent is exposed; automated test proves Stripe is not called.
- [ ] Database temporarily fails after provider success; reconciliation finalizes later.
- [ ] Payment failure releases reservation and retains cart.

### Acceptance criteria

- [ ] Every successful staging PaymentIntent maps to exactly one order.
- [x] No confirmation request accepts a provider ID as an order identifier; request validation requires an internal UUID.
- [ ] Closing the browser cannot create a paid-but-missing order.
- [x] Cart clearing occurs only after a verified `confirmed` and `paid` order response.
- [ ] Staff can query unresolved payment attempts and reconciliation results.

Local verification evidence (2026-09-29): backend build and typecheck passed; 10/10 backend tests passed, including draft-before-intent and failure cleanup; frontend production build passed; targeted lint for all three modified frontend files passed with zero errors; `git diff --check` passed. Supabase migration application and Stripe staging scenarios remain pending.

## CH-003 — Finalization and commerce side effects are not atomic or idempotent

**Priority:** P0  
**Status:** CODE COMPLETE
**Dependencies:** CH-002, CH-010  
**Affected paths:** checkout/PayPal controllers, email sending, order history, coupon and stock RPCs

### Evidence

- Stripe browser confirmation inserts the order, then items, then decrements each product in a loop, then increments coupon use, then asynchronously emails.
- Stripe webhook separately updates, decrements stock again, and emails again when it finds an order.
- The comment assumes a second stock RPC will error, but the version-controlled repository contains no RPC definition proving idempotency.
- PayPal inserts order and items in separate operations and increments coupon later.
- There is no version-controlled unique constraint on provider transaction identity.

### Impact

- Duplicate orders, stock decrements, coupon increments, or emails.
- Partial state: order without items, items without all stock updates, or paid order without coupon/history state.
- Overselling due to non-atomic stock checks.

### Solution

1. Create transaction-safe database functions for draft reservation, paid finalization, and release/cancellation.
2. Lock relevant order, product, and coupon rows in a consistent order.
3. Use state transitions and affected-row counts to make repeated calls return the already-finalized result.
4. Enforce provider transaction uniqueness at the database layer.
5. Write status history inside the finalization transaction.
6. Insert a unique outbox event in the same transaction; deliver email outside the transaction with retries.
7. Stop directly decrementing stock or incrementing coupon use from controllers.
8. Return typed outcomes for finalization and release, including `finalized`, `already_finalized`, `released`, `already_released`, `payment_mismatch`, and `invalid_transition`.

### Implemented behavior

- `202609290001_ch003_atomic_checkout_finalization.sql` versions transactional draft creation, stock/coupon reservation, paid finalization, reservation release, order history, and a retryable outbox. Product and coupon rows are locked in stable order; nullable coupon counters are normalized safely.
- Stripe webhook and browser confirmation use the same typed finalizer. Repeated finalization returns `already_finalized`; mismatched provider transactions are rejected. Failed-payment release also verifies the Stripe transaction before restoring inventory.
- Checkout controllers no longer decrement stock, increment coupons, or send confirmation email directly. The unique outbox event is written with finalization and delivered by a worker using a stable Resend idempotency key.
- Expired Stripe reservations are reconciled by checking provider state: successful payments finalize, while unpaid intents are cancelled before inventory is released.
- The current PayPal capture path uses the same atomic database effects and a deterministic provider request ID. Its remaining trust in browser-supplied checkout data is deliberately tracked under CH-004.

### Deployment and rollback

1. Applied `202609280001_ch002_pending_stripe_orders.sql` first, then `202609290001_ch003_atomic_checkout_finalization.sql` in Supabase on 2026-09-29; the post-migration object check passed 12/12.
2. Deploy the backend only after both migrations succeed, then run duplicate-delivery and concurrent stock/coupon checks in staging.
3. If application rollout fails, roll back the backend before changing the schema. Preserve orders, reservations, and outbox rows for reconciliation; do not blindly restore stock for any payment that may have succeeded.

Verification evidence (2026-09-29): backend TypeScript build and 13/13 tests passed; frontend production build passed; targeted lint for the two modified frontend files passed; `git diff --check` passed; both Supabase migrations were applied and all 12 schema/function checks returned `true`. The repository-wide frontend lint remains red from pre-existing unrelated debt tracked by CH-012. Real database concurrency tests, provider staging callbacks, and rollback exercise remain pending, so CH-003 is not yet `VERIFIED`.

### Required observability

- Order ID, provider, provider event/capture ID, transition result, attempt count, and duration.
- Metrics for unresolved drafts, failed finalizations, duplicate events, released reservations, negative-stock prevention, and outbox failures.
- No address, email, provider secret, or card/payment payload in logs.

### Tests

- [ ] Run the same provider event concurrently multiple times; one set of effects occurs.
- [ ] Run browser confirmation and webhook concurrently; one result occurs.
- [ ] Force failure after each logical step; transaction rolls back or outbox retries safely.
- [ ] Two customers attempt the final stock unit; at most one reservation succeeds.
- [ ] Coupon with one remaining use is attempted concurrently; at most one reservation succeeds.
- [ ] Email provider fails and later retry sends once.

### Acceptance criteria

- [x] Database constraints and functions are version-controlled.
- [x] No controller contains a per-item stock-decrement loop for finalization.
- [ ] Duplicate provider delivery returns 2xx and does not duplicate effects.
- [ ] An automated concurrency test covers stock and coupon limits.

## CH-004 — PayPal trusts browser checkout data and misses inventory effects

**Priority:** P0  
**Status:** CODE COMPLETE
**Dependencies:** CH-003  
**Affected paths:** `backend/src/controllers/paypal.controller.ts`, `frontend/src/lib/api-client.ts`, `frontend/src/routes/checkout.tsx`

### Evidence

- `createPayPalOrder()` returns `_checkoutData` containing totals, address, coupon ID, item names, quantities, and prices.
- The browser sends that object back to `capturePayPalOrder()`.
- After PayPal capture, the backend inserts the order and items directly from the browser-returned object.
- It does not verify returned checkout data against a server-side draft or PayPal amount/reference.
- It stores the PayPal order ID rather than the capture transaction ID.
- It increments coupon usage but never decrements/reserves inventory.
- PayPal coupon calculation lacks the Stripe flow’s per-customer/per-email reuse check.

### Impact

- A modified client can alter application order contents, address, item snapshots, coupon ID, or recorded total after paying a different provider amount.
- Inventory remains incorrect after PayPal purchases.
- Coupon reuse behavior differs by provider.
- Retry after successful capture can create duplicate orders without a uniqueness guarantee.

### Solution

1. Reuse the server-owned pending order from CH-002; return only PayPal order ID, internal order ID, and guest token/public status data.
2. Remove `_checkoutData` from the public response and capture request.
3. On capture, load the pending order server-side.
4. Verify PayPal order/capture status, currency, amount, and `reference_id` against the pending order.
5. Record the immutable capture ID as the provider transaction ID; optionally retain provider order ID in a separate column.
6. Send a PayPal capture idempotency key.
7. Call the shared CH-003 finalizer; do not create items or mutate coupon/stock in the PayPal controller.
8. Add PayPal webhook/reconciliation support for capture outcomes and interrupted requests.

### Implemented behavior

- PayPal now creates the complete Supabase draft and reserves stock/coupon capacity before creating or exposing a payable provider order.
- The public create response contains only identifiers, guest confirmation token, and display totals. `_checkoutData` and all browser-returned item, address, coupon, and price data were removed from the capture contract.
- Capture loads the trusted draft, enforces customer ownership or the hashed guest token, and rejects a mismatched internal/PayPal order pair before contacting PayPal.
- PayPal order ID, capture status, capture ID, `USD` currency, exact cents, and order reference are checked against the draft. `finalize_paypal_capture` atomically stores the uniquely constrained capture ID and calls the shared CH-003 finalizer.
- Stable PayPal request IDs make create/capture retries safe. Duplicate capture requests return the already-finalized internal order without repeating provider or commerce effects.
- Expired PayPal drafts are reconciled against provider state: completed captures are verified/finalized; unpaid provider orders release their reservation. Provider or database linkage failures release unexposed drafts.
- Coupon eligibility now includes the same customer/email reuse checks used by Stripe, while the transactional reservation remains authoritative for global limits.

### Deployment and rollback

1. Apply `202609290002_ch004_trusted_paypal_drafts.sql` after CH-003 and before deploying this backend.
2. Verify the new column, unique provider-order index, `link_paypal_order`, and `finalize_paypal_capture`, then run PayPal sandbox create/capture/retry and interrupted-response scenarios.
3. For rollback, restore the previous backend while retaining the additive column/functions. Do not remove reservations or captured-payment records until PayPal-to-order reconciliation is complete.

Verification evidence (2026-09-29): backend TypeScript build and 19/19 tests passed; focused tests cover draft-before-provider ordering, setup/link cleanup, strict capture payload, provider identity/reference/status/currency/amount checks, and completed-versus-unpaid reconciliation; frontend production build and targeted lint passed; `_checkoutData` has no runtime source matches; `git diff --check` passed. The CH-004 Supabase migration was applied; 8/8 object/permission checks passed; a rollback-only database functional test confirmed amount-mismatch rejection, single stock reservation, atomic finalization, duplicate idempotency, one history row, and one outbox event. PayPal sandbox and true concurrent-capture scenarios remain pending, so CH-004 is not yet `VERIFIED`.

### Tests

- [x] Tampered client total/items/address/coupon fields are impossible because capture accepts no such fields.
- [x] Captured amount or currency mismatch stops finalization and alerts operations.
- [ ] Successful PayPal purchase changes inventory exactly once.
- [ ] Duplicate capture/finalization request returns the existing order.
- [ ] Coupon ownership/global limits behave identically to Stripe.
- [ ] DB failure after provider capture is recovered through reconciliation.

### Acceptance criteria

- [x] `_checkoutData` no longer exists in frontend or backend contracts.
- [x] PayPal and Stripe call the same order finalization boundary.
- [x] Provider capture ID is uniquely stored.
- [ ] PayPal success passes stock/coupon concurrency tests.

## CH-005 — Customer-support ownership is not enforced

**Priority:** P0  
**Status:** CODE COMPLETE
**Dependencies:** CH-010, central optional-auth helper  
**Affected paths:** query routes/controllers/client/widget; conversation schema

### Evidence

- Public routes accept `customer_id`, `guest_email`, and `sender_id` from the client.
- Messages are returned for any supplied conversation UUID.
- Any caller with a UUID can send a message or mark the conversation read.
- Unread count accepts arbitrary customer ID or email.
- `supabaseAdmin` bypasses RLS.
- The widget decodes a JWT client-side to extract `sub`, then submits it as trusted customer identity.

### Impact

- Cross-customer conversation disclosure and modification.
- Guest impersonation using only an email address.
- False sender IDs and unread-state tampering.

### Solution

1. Apply `optionalAuth` or separate authenticated/guest handlers to every customer query route.
2. For authenticated users, ignore `customer_id`/`sender_id` input and resolve the customer row from `req.user.id`.
3. For guests, issue an opaque token when creating a conversation and store only its hash.
4. Require the guest token in `X-Guest-Conversation-Token` for message read/write/unread/read-state requests; add this header to CORS.
5. Add `requireConversationOwner()` middleware/service that returns a minimal authorized conversation context.
6. Never return token hashes, internal customer IDs, or unnecessary guest data.
7. Rate-limit guest conversation creation and message sending separately; add abuse/spam controls.
8. Refactor the widget to use `useAuth()` instead of decoding the JWT itself.
9. Store only conversation ID and guest token locally; email/name are profile inputs, not authorization.

### Implemented

- Every customer-support route now uses `optionalAuth` and a central ownership resolver.
- Account conversations are resolved from the verified auth user to `customers.id`; submitted customer and sender IDs are rejected and never used as ownership proof.
- New guest conversations receive a 256-bit opaque token. Only its SHA-256 hash is stored, and the raw token is returned once and sent in `X-Guest-Conversation-Token` thereafter.
- Customer routes are singular current-conversation routes and do not accept a conversation UUID. Responses omit token hashes, customer IDs, guest profile fields, and sender IDs.
- Conversation creation and message sending have dedicated production rate limits.
- Direct `anon`/`authenticated` table access and legacy database helper functions are removed by `202609290003_ch005_secure_conversation_ownership.sql`; only `service_role` receives table CRUD access.
- The widget uses `useAuth()`, no longer decodes JWTs, and persists only the guest conversation ID and guest token.
- Legacy guest rows without a token are intentionally not recoverable by email; those users must start a new secure conversation.

### Proposed API

```text
POST /api/queries/conversation
  authenticated: body may omit identity
  guest: body { guestName, guestEmail }
  response { conversation, guestToken? }

GET/POST /api/queries/conversation/messages
PATCH /api/queries/conversation/read
GET /api/queries/conversation/unread-count
  account: Authorization bearer/cookie-derived identity
  guest: X-Guest-Conversation-Token
```

Using a singular current-conversation route reduces exposure of arbitrary IDs because the product model is one continuous thread per identity.

### Tests

- [ ] Customer A cannot read/write/mark Customer B’s conversation.
- [ ] Changing a submitted customer ID has no effect.
- [x] Guest email without token grants no access (ownership unit test).
- [x] Wrong, expired, or revoked guest token returns 401/403 (ownership unit test/repository filter).
- [ ] Admin role routes remain authorized and audited.
- [x] Token hashes and internal owner identifiers are absent from customer API projections.
- [ ] Rate limiting blocks message spam without breaking ordinary polling.

### Acceptance criteria

- [x] No public query handler trusts `customer_id`, `guest_email`, or `sender_id` as proof of ownership.
- [x] Central ownership code covers every customer-side operation.
- [ ] Cross-user integration tests pass.
- [x] Existing guests receive a documented migration/re-authentication behavior.

Verification evidence (2026-09-29): backend TypeScript build and 24/24 tests passed, including five focused ownership/token tests; frontend production build and targeted lint for the chat button, widget, and queries client passed. Static scans found no legacy plural customer routes, browser JWT decoding, or persisted guest email/name authorization data. The migration and live cross-account/guest-token tests remain pending, so CH-005 is not yet `VERIFIED`.

## CH-006 — Order summary exposes PII by order UUID

**Priority:** P0  
**Status:** CODE COMPLETE
**Dependencies:** CH-002 guest token design  
**Affected paths:** checkout order route/controller, API client, confirmation page

### Evidence

- `GET /api/checkout/order/:id` is public.
- Controller performs `select("*")` on `orders` and `order_items`.
- Confirmation UI displays customer email and full shipping address.
- Possession of an order UUID is the only check.

### Impact

- Leaked URL, browser history, logs, analytics, support screenshots, or referrers can disclose PII and order contents.
- Internal fields may be exposed as schema evolves because of wildcard selection.

### Implemented

- The existing CH-002 guest confirmation token and `optionalAuth` ownership path now protect order retrieval through one tested access decision.
- Account ownership is derived from the verified auth user and `customers.id`; unauthorized and missing orders both return the same `404` response.
- Guest proof is sent in `X-Order-Confirmation-Token`, not an API query string. The confirmation page moves the redirect token into tab-scoped `sessionStorage` and immediately removes it from browser history while preserving refresh.
- Order and item selects are explicit. The response mapper exposes only confirmation fields and excludes customer IDs, token hashes, email, shipping address, notes, and other internal order data.
- Confirmation responses use `Cache-Control: private, no-store`; the page is `noindex` and `no-referrer`.
- No database migration was required because CH-002 already added and populated the guest token hash contract.

### Solution

1. Apply optional authentication.
2. Authenticated customers must own the order through their `customers.id`.
3. Guests must present the high-entropy confirmation token issued with the pending order; compare its hash server-side.
4. Use explicit columns and a `toConfirmationOrder()` mapper.
5. Return only fields required by the confirmation UI.
6. Add `Cache-Control: no-store`, prevent referrer leakage, and keep the page `noindex`.
7. Prefer passing the guest token in a fragment or secure storage when possible; if a query parameter is required, scrub it from the URL with `history.replaceState()` after loading.
8. Ensure logs and analytics redact the token and address.

### Tests

- [x] Owner access and cross-customer rejection pass focused ownership tests.
- [x] Another authenticated customer receives the same non-disclosing `404` path.
- [x] Guest token matching and wrong/missing-token rejection pass focused tests.
- [x] Guest with only UUID cannot retrieve it.
- [x] Explicit response projection test excludes ownership, token, address, and notes.
- [x] Response sets `Cache-Control: private, no-store`.

### Acceptance criteria

- [x] Route has account ownership/guest-token proof.
- [x] Response is explicitly typed and minimal.
- [x] Confirmation UI preserves guest proof across token scrubbing and page refresh.
- [ ] PII access tests pass.

Verification evidence (2026-09-29): backend TypeScript build and 28/28 tests passed, including account ownership, cross-account rejection, exact guest-token proof, UUID-only denial, and explicit minimal projection tests. Frontend production build passed; targeted lint and `git diff --check` passed after formatting. A deployed browser/API privacy check remains pending, so CH-006 is not yet `VERIFIED`.

## CH-007 — Gateway activation, cache, and secret responses are unsafe

**Priority:** P1  
**Status:** CODE COMPLETE
**Dependencies:** CH-010  
**Affected paths:** payment-gateway controller/types, Stripe config/cache, admin UI, database

### Evidence

- `activatePaymentGateway()` comments that it deactivates peers but only sets one row to active.
- Active gateway readers use `.maybeSingle()`, which errors if multiple rows are active.
- Stripe SDK cache is keyed only by gateway row ID. Editing a secret in the same row leaves the old SDK instance cached until restart or gateway ID change.
- Admin detail endpoint returns full stored credentials to the browser.

### Impact

- Checkout can fail after activating a second account.
- Updated credentials may not take effect immediately despite the database-only design.
- Full secrets have unnecessary browser exposure.

### Implemented

- Added a migration that normalizes duplicate active rows and enforces at most one active gateway per provider with a partial unique index.
- Added a service-role-only activation RPC that serializes activation by provider, validates required credentials, deactivates peers, activates the target, and records the acting staff member.
- Routed create, update, and activate flows through the same RPC whenever a gateway is requested as active.
- Removed the long-lived Stripe client cache, so each payment request reads the currently active credentials.
- Changed admin list/detail responses to masked credential hints only; editing leaves secret fields blank and sends replacements only when entered.
- Added no-store headers to every admin gateway response and kept the audit table inaccessible to browser roles.

### Solution

1. Add a partial unique index that permits at most one active row per `gateway_type`.
2. Implement an atomic `activate_payment_gateway(id)` RPC/transaction that validates credentials, deactivates peers, and activates the target.
3. Make create/update with `isActive=true` use the same operation.
4. Remove the long-lived Stripe instance cache, or key it by safe version state such as gateway ID plus `updated_at` with a short TTL. Never log key material.
5. Return only masks/presence flags from list/detail. Admin edit sends a replacement secret only when intentionally changed.
6. Add `Cache-Control: no-store` on all payment-gateway administration responses.
7. Record staff ID and change type in an audit table without recording secret values.
8. Evaluate envelope encryption/secret manager storage for provider secrets.

### Tests

- [ ] Concurrent activations leave exactly one active row per type.
- [x] Stripe cache removal is covered by a focused regression test; live credential rotation remains pending.
- [x] Admin GET responses return masked credential hints only.
- [x] Existing authenticated-admin route guards block non-admin roles.
- [x] Migration/RPC audit records identify actor/action without credential material.

### Acceptance criteria

- [x] Database partial unique index independently enforces at most one active gateway per type.
- [x] Credential rotation takes effect on the next Stripe client construction without restart.
- [ ] Browser/network inspection shows no existing full secret (live inspection pending).

Verification evidence (2026-09-29): backend TypeScript build and 31/31 tests passed; focused tests cover masked responses, absence of Stripe credential caching, and migration definitions. Frontend production build and `git diff --check` passed. The migration was applied and 8/8 live structural checks passed: audit table/RLS, unique active-gateway index, absence of duplicate active types, RPC presence, and role permissions. Real concurrent activation, live rotation, and browser/network inspection remain pending, so CH-007 is not yet `VERIFIED`.

## CH-008 — Supabase auth client violates least privilege

**Priority:** P1  
**Status:** CODE COMPLETE
**Dependencies:** Environment/deployment update  
**Affected paths:** Supabase config, env schema/example, auth controller, deployment settings

### Evidence

- `supabaseAuth` is described as anon-level but is created with `SUPABASE_SERVICE_ROLE_KEY`.
- Login, refresh, and reset-session operations therefore use a more privileged project key than necessary.

### Solution

1. Add server-side `SUPABASE_ANON_KEY` validation and example configuration.
2. Create `supabaseAuth` with the anon key and session persistence disabled.
3. Keep `supabaseAdmin` service-role-only for explicit admin/database operations.
4. Review password reset calls and use the least privileged API that supports the operation.
5. Add a static test/assertion that frontend environment/bundles never contain either server key.
6. Rotate the service-role key if evidence shows it was exposed outside trusted backend infrastructure.

### Implemented

- Added required `SUPABASE_ANON_KEY` validation and backend environment documentation.
- Constructed `supabaseAuth` with the anon key while retaining the service-role key exclusively on `supabaseAdmin`.
- Moved password-reset email requests to the anon client; explicit trusted admin operations remain on the admin client.
- Added a focused regression test that locks the client/key separation and environment contract.

### Tests and acceptance

- [ ] Register, login, refresh, reset, logout, `requireAuth`, and inactive-user rejection pass.
- [x] Anon auth client is constructed with the anon key and therefore has no service-role privileges.
- [x] Missing anon key fails environment validation during startup.
- [x] `SUPABASE_ANON_KEY` is present in the backend environment.
- [x] Frontend source contains no references to either backend Supabase key variable.

Verification evidence (2026-09-29): TypeScript build and 32/32 backend tests passed, including the least-privilege regression test. Frontend source key-reference scan and `git diff --check` passed. The user confirmed `SUPABASE_ANON_KEY` is already configured in the backend environment. Deployed register/login/refresh/reset/logout, inactive-user rejection, and bundle/log inspection remain pending, so CH-008 is not yet `VERIFIED`.

## CH-009 — Browser session tokens and CSP need hardening

**Priority:** P1  
**Status:** CODE COMPLETE
**Dependencies:** CH-008; CORS/hosting decision  
**Affected paths:** AuthContext, API clients, auth routes/controllers, CORS, frontend headers

### Evidence

- Access and refresh tokens are persisted in `localStorage`.
- Any successful XSS can read and exfiltrate the long-lived refresh token.
- Frontend `_headers` has frame/content/referrer/permissions headers but no Content Security Policy.

### Target session model

- Refresh token: `HttpOnly`, `Secure`, `SameSite=Lax` cookie with narrow path and rotation.
- Access token: memory only, refreshed on application startup; alternatively use a fully cookie-backed session with explicit CSRF protection.
- API requests: `credentials: "include"` where required.
- CORS: exact origins and `credentials: true`; never wildcard.
- CSRF: SameSite plus Origin/Referer validation and a CSRF token for state-changing cookie-authenticated requests.
- Logout: invalidate server/provider session and expire cookie.

### Migration plan

1. Add cookie support without immediately removing bearer access-token verification.
2. Change login/register/refresh responses to set rotated refresh cookie and omit refresh token from JSON.
3. Hydrate user/access state through a session/bootstrap endpoint.
4. Update both API clients to stop reading the refresh token from storage.
5. Migrate existing users by requiring one new login; remove old keys on startup/logout.
6. Add CSP in report-only mode, collect violations, then enforce. Account for Stripe, PayPal, Google Fonts, image hosts, API origin, and TanStack runtime requirements.

### Implemented

- Login/register now set the rotating refresh token in an HttpOnly, SameSite=Lax cookie scoped to `/api/auth`; production cookies are Secure.
- Refresh reads and rotates only the cookie and returns only a new access token; logout expires the cookie and invalidates the provider session when a bearer token is available.
- The frontend keeps access tokens in a shared in-memory module, restores sessions through the cookie on startup, and removes legacy auth storage keys.
- Every API/admin/query token consumer now reads the in-memory token; credentialed CORS remains restricted to configured exact origins.
- Added a payment-aware CSP in report-only mode for safe violation collection before enforcement.
- Added focused regression tests for cookie attributes, token response/storage boundaries, CORS, and CSP.

### Tests and acceptance

- [x] Refresh token is absent from JavaScript-visible storage and JSON responses.
- [x] Cookie has HttpOnly, production-only Secure, SameSite=Lax, and `/api/auth` path attributes.
- [x] Cross-site cookie requests are blocked by SameSite and exact-origin credentialed CORS.
- [x] CORS permits configured frontend origins and rejects unlisted origins at code level.
- [ ] Token rotation, concurrent tabs, expiry, password reset, and logout pass.
- [ ] CSP enforcement does not break Stripe, PayPal, images, fonts, SSR, or hydration.

Verification evidence (2026-09-29): backend TypeScript build and 34/34 tests passed, including cookie/session/CORS/CSP regression checks. Frontend production build passed; focused lint passed with zero errors and one pre-existing Fast Refresh warning. Repository scan found no access/refresh-token localStorage reads or writes, and `git diff --check` passed. Browser cookie inspection, live auth lifecycle/concurrent-tab testing, CSP report review, and promotion to enforcement remain pending, so CH-009 is not yet `VERIFIED`.

## CH-010 — Database schema and RPCs are not reproducible

**Priority:** P1  
**Status:** CODE COMPLETE
**Dependencies:** Access to authoritative Supabase project  
**Affected paths:** repository layout, `.gitignore`, all database-dependent work

### Evidence

- `.gitignore` globally ignores SQL.
- Only two historical query SQL files exist locally; neither is a complete current schema.
- Code calls `decrement_product_stock` and `increment_coupon_usage`, but their definitions and guarantees are absent.
- Constraints needed for payment idempotency and gateway uniqueness cannot be verified from Git.

### Solution

1. Add `supabase/migrations/` and whitelist it from the SQL ignore rule.
2. Export and review the authoritative live schema without data/secrets.
3. Establish a baseline migration for a clean environment and a safe “mark baseline applied” procedure for existing production.
4. Add forward migrations for checkout integrity, guest access tokens, gateway invariants, outbox, indexes, and RPCs.
5. Version storage bucket/policy configuration and seed only non-sensitive reference data.
6. Run targeted object and permission checks in Supabase after each migration.
7. Never use broad `DROP`/wipe operations against an existing environment during baseline adoption.

### Current progress

- Added `202609270000_current_schema_baseline.sql` before every forward migration. It differs from the authoritative schema-only dump only by removing two `psql` session guards and making `public` schema creation idempotent.
- CH-002, CH-003, CH-004, CH-005, and CH-007 forward migrations remain ordered and replay-safe over the baseline.
- Added a versioned `product-images` storage bucket with the uploader's 10 MB and MIME-type limits.
- Documented a non-destructive existing-project adoption procedure using migration-history repair plus `db push --dry-run`; it explicitly forbids running the baseline or linked reset against production.
- Preserved the raw authoritative dump locally for audit comparison; the versioned baseline contains no data rows or credentials.

Suggested layout:

```text
supabase/
├── config.toml
├── migrations/
│   ├── <timestamp>_baseline.sql
│   ├── <timestamp>_checkout_integrity.sql
│   ├── <timestamp>_conversation_access.sql
│   └── <timestamp>_gateway_invariants.sql
├── seed.sql                 non-sensitive development reference data only
```

### Acceptance criteria

- [x] The authoritative public schema can be created from the versioned baseline.
- [ ] Existing Supabase migration history is aligned and the storage migration is applied.
- [x] Functions, triggers, indexes, constraints, RLS, and storage configuration are versioned.

Verification evidence (2026-09-30): baseline-to-dump diff contains exactly the three documented sanitizations; migration ordering, runtime-RPC coverage, schema-only/no-secret scans, and `git diff --check` passed. Supabase migration-history alignment, the storage migration, and their post-apply checks remain pending, so CH-010 is not yet `VERIFIED`.

## CH-011 — No automated tests or CI release gate

**Priority:** P1  
**Status:** IN PROGRESS
**Dependencies:** None; begin early  
**Affected paths:** backend/frontend packages, server entry, new test and CI files

### Evidence

- Backend application creation is separated from process startup and supports middleware/HTTP testing.
- The backend currently has 34 passing regression tests covering the repaired P0/P1 paths.
- No CI workflow previously enforced those checks on pushes or pull requests.
- Database integration, frontend component, and browser E2E coverage are still absent.

### Implemented

- Added a least-privilege GitHub Actions workflow for every pull request and `main` push.
- Both jobs use Node 22, lockfile-backed `npm ci`, dependency caching, and read-only repository permissions.
- The backend job runs its TypeScript build and all tests through `npm test`.
- The frontend job enforces zero lint findings and produces the full production build.
- Concurrent runs on the same ref are cancelled to avoid wasting CI time.
- The isolated workflow commit `f96f0ef` was pushed to `origin/main`; other local remediation changes were not included.

### Solution

1. Split `backend/src/app.ts` (`createApp`) from `backend/src/index.ts` (`listen`).
2. Add Vitest and Supertest for controller/middleware HTTP tests.
3. Extract Stripe/PayPal adapters and checkout service interfaces for deterministic fakes.
4. Run SQL/integration checks against the Supabase staging project.
5. Add frontend Vitest + Testing Library for contexts/forms and Playwright for critical E2E flows.
6. Add a CI pipeline with deterministic install, migration test, backend typecheck/test/build, frontend lint/test/build, and secret scanning.
7. Make all P0 regression tests required before merge/deploy.

### Minimum test layers

| Layer | Coverage |
|---|---|
| Unit | Totals, coupon rules, mappings, token hashing, state transitions |
| HTTP integration | Auth, roles, ownership, raw webhook signatures, response projections |
| Database integration | Migrations, uniqueness, locking, reservation/finalization idempotency |
| Provider contract | Stripe/PayPal adapter request and response validation with fakes/sandboxes |
| Browser E2E | Customer checkout, redirects, confirmation, chat, admin permissions |

### Acceptance criteria

- [x] CI is configured for every pull request and `main` branch change.
- [x] Existing P0 regression tests exercise the repaired failure modes.
- [x] Current automated tests use no live production credentials.
- [x] CI workflow contains no secrets and tests use synthetic identifiers/keys.

Remaining before `VERIFIED`: confirm the updated workflow passes in GitHub and add frontend component/browser coverage for critical flows.

## CH-012 — Frontend lint fails

**Priority:** P1  
**Status:** CODE COMPLETE
**Dependencies:** Coordinate with active feature changes  
**Affected paths:** 29 frontend files

### Baseline

| Rule | Count |
|---|---:|
| `prettier/prettier` | 115 |
| `@typescript-eslint/no-explicit-any` | 66 |
| `react-refresh/only-export-components` | 12 |
| `no-empty` | 8 |
| `react-hooks/exhaustive-deps` | 6 |
| `@typescript-eslint/no-unused-expressions` | 1 |

### Solution order

1. Apply Prettier as a mechanical, isolated change and review the diff.
2. Replace `any` with domain types, `unknown` plus narrowing, or library-provided types.
3. Fix hook dependencies by stabilizing callbacks/values; do not suppress warnings until behavior is proven.
4. Replace empty catches with intentional handling/comments or remove unnecessary try/catch.
5. Move non-component exports where needed to satisfy refresh rules, or configure narrow justified exceptions for standard UI patterns.
6. Fix the unused expression.
7. Add `lint` to CI and keep zero errors as the required gate. Decide separately whether existing refresh warnings become errors.

### High-risk lint areas

- Customer/admin query polling and effect cleanup
- Admin dashboard effects and data shapes
- Checkout error handling
- Context persistence/hydration

### Implemented

- Applied Prettier and corrected the remaining semantic lint findings instead of suppressing them globally.
- Replaced unsafe catch values with `unknown` plus one shared error normalizer and added domain types for admin forms/API payloads.
- Corrected hook dependencies, storage error handling, browser API declarations, lazy-loading generics, and the customer-order field mapping.
- Added one narrow refresh-rule exception for intentional component-plus-hook/style co-exports only.
- Added the zero-finding frontend lint command to CI before the production build.

### Acceptance criteria

- [x] `npm run lint` exits zero.
- [x] No blanket rule disable was added.
- [ ] Query polling has fake-timer lifecycle tests.
- [ ] Checkout and authentication behavior still passes E2E tests.

Verification evidence (2026-09-29): the original 190-error/18-warning baseline (135 errors/17 warnings at the start of this repair) is now 0/0. Full frontend lint and production build passed; backend build and 34/34 tests passed; `git diff --check` passed. Polling fake-timer tests and checkout/authentication browser E2E remain under CH-011, so CH-012 is not yet `VERIFIED`.

## CH-013 — Frontend deployment target is inconsistent

**Priority:** P1  
**Status:** PENDING
**Dependencies:** Product/infrastructure decision  
**Affected paths:** frontend Vite/package config, deployment automation, README

### Evidence

- Lovable configuration currently produces a `cloudflare-module` Nitro build.
- `frontend/package.json` has no production `start` script.
- Historical Hostinger guidance expected `npm run start` under PM2.

### Decision

Select exactly one supported production target and encode it in repository configuration and CI. Given the historical Hostinger/VPS intent, the likely choice is a Nitro Node deployment with:

```json
{
  "scripts": {
    "build": "vite build",
    "start": "node .output/server/index.mjs"
  }
}
```

This command matches the current official TanStack Start Node/Nitro deployment guidance, but it must be verified against the exact generated artifact and Lovable config version in staging: [TanStack Start hosting documentation](https://tanstack.com/start/latest/docs/framework/react/guide/hosting).

If Cloudflare remains the choice, remove VPS/PM2 frontend assumptions and commit the required provider configuration. Do not keep both as implicit defaults.

### Work

1. Record the chosen platform and runtime version.
2. Configure the Nitro/deployment preset explicitly rather than inheriting a surprising default.
3. Add a production start/deploy command.
4. Build and start the exact artifact in CI or a container smoke test.
5. Configure health checks, environment variables, logs, proxy/CDN caching, and rollback.
6. Run SSR, asset, route refresh, API CORS, payment redirect, and service-worker tests against staging.

### Acceptance criteria

- [ ] A clean clone can build and start/deploy with documented commands.
- [ ] Process responds to health/smoke requests after restart.
- [ ] Deep links and SSR routes work directly.
- [ ] Payment return URLs use the real canonical origin.
- [ ] Deployment rollback is exercised.

## CH-014 — Configuration and documentation drift

**Priority:** P2  
**Status:** CODE COMPLETE
**Dependencies:** Complete related P0/P1 behavior first

### Original evidence

- Checkout comments claim TaxJar behavior, while `calculateTax()` always returns zero tax.
- PayPal create-order comment incorrectly describes the trusted-draft flow.
- PayPal client-ID endpoint duplicates active-gateways but may have external consumers.
- Deprecated payment environment variables remain despite database-only behavior.
- `/feed/status` is public even though its comment says future admin protection.
- Both Bun and npm frontend lockfiles exist.
- README retains historical findings already repaired by earlier CH work.

### Implemented

- Corrected tax, PayPal draft, feed-status, environment, API, and remediation documentation.
- Restricted feed operational status to authenticated administrators and added a regression assertion.
- Removed five unused payment environment declarations, one unused legacy query helper, and the unused `vite-tsconfig-paths` dependency.
- Standardized local and CI frontend installs on npm with one lockfile.
- Preserved the PayPal client-ID compatibility endpoint and unreferenced fixture modules because repository inspection cannot exclude external or future consumers.
- Confirmed CH-007 already atomically deactivates peer gateways; no gateway behavior was changed.

### Solution

1. Correct comments in the same changes that fix behavior.
2. Remove deprecated endpoints only after callers are migrated and compatibility is checked.
3. Remove unused env fields and update examples/deployment environments.
4. Protect operational status routes with appropriate staff roles or document why data is intentionally public.
5. Choose one frontend package manager and retain one lockfile.
6. Add a documentation/code checklist to pull-request templates.

### Acceptance criteria

- [x] Source comments describe current behavior.
- [x] No routed endpoint is labelled deprecated without an explicit removal plan.
- [x] Environment schema contains only used variables.
- [x] Deterministic install uses one frontend lockfile.

Verification evidence (2026-09-30): frontend lint passed with zero findings; the production frontend build passed; backend TypeScript build and 35/35 tests passed, including the feed-status administrator-guard assertion. Final stale-reference and diff-integrity checks passed. The PayPal compatibility endpoint and unreferenced fixture modules were intentionally preserved.

## CH-015–CH-023 — Follow-up audit corrections

**Status:** CODE COMPLETE
**Dependencies:** CH-003, CH-004, CH-007, CH-010, CH-011

The follow-up review and verification pass found nine defects that were not represented by the original register. They are tracked separately so the earlier completion evidence remains historically accurate.

| ID | Implemented correction | Remaining before `VERIFIED` |
|---|---|---|
| CH-015 | A failed Stripe attempt retains its reservation; expiry reconciliation cancels a still-payable intent before release. A locally signed failure webhook passed without contacting Stripe. | End-to-end Stripe sandbox decline-then-retry test |
| CH-016 | PayPal reconciliation finalizes `COMPLETED`, releases only terminal `VOIDED`, and retains `APPROVED`/other capturable states. | PayPal sandbox approval/capture race test |
| CH-017 | Orders store `payment_gateway_id`; confirm, capture, reconciliation, and Stripe webhook verification use the bound account, including inactive accounts after rotation. Referenced gateways cannot be deleted. | Exercise sandbox account rotation |
| CH-018 | General API limiting counts successful requests and checkout-draft creation has a stricter success-counting limiter. Production-mode requests 1–10 passed and request 11 returned `429` in an isolated test. | Staging proxy/load threshold review |
| CH-019 | The draft RPC locks the coupon, checks existing reserved/committed use by customer or normalized guest email, and inserts the reservation in the same transaction. Concurrent coupon and final-stock races passed on the configured Supabase target, with zero temporary rows left behind. | None |
| CH-020 | The three frontend TypeScript errors were corrected; `typecheck` is now a required CI step. | Confirm GitHub workflow run |
| CH-021 | Backend ESLint and its TypeScript configuration are installed; lint is now a required CI step. | Confirm GitHub workflow run |
| CH-022 | Nonexistent legacy schema-file references were removed; production instructions now point operators to the migration runbook. | Documentation review during deployment rehearsal |
| CH-023 | Compatible lockfile updates resolved five `multer`, `ip-address`, and Express/`qs` production advisories; CI now rejects high-severity production advisories. | Confirm GitHub workflow run |

The forward migration `202610010001_followup_checkout_integrity.sql` is applied to the configured Supabase target; previously applied migrations were not edited. CH-019 is verified. Payment-provider and account-rotation items remain `CODE COMPLETE` until their named sandbox checks pass.

## 6. Proposed migration and API inventory

This is a planning inventory; exact SQL must be derived from the authoritative schema and reviewed before execution.

### Database migrations

| Migration | Main contents |
|---|---|
| Baseline | Current tables, types, FKs, indexes, functions, triggers, RLS, storage policies |
| Checkout integrity | Pending/reservation/finalization fields, transaction uniqueness, outbox, atomic RPCs |
| Conversation access | Guest token hash/rotation fields and indexes; remove unsafe assumptions |
| Gateway invariants | Partial unique active-gateway index and atomic activation/audit function |
| Follow-up checkout integrity | Order-to-gateway FK/binding, normalized guest email, transactional coupon identity enforcement |
| Session support, if needed | Server session/refresh token metadata or revocation/audit structures |

### Checkout APIs after remediation

| Endpoint | Intended behavior |
|---|---|
| `POST /checkout/stripe/order` | Validate, reserve, create pending order and PaymentIntent; return client secret plus internal order reference |
| `POST /checkout/stripe/confirm` | Verify provider state and invoke shared finalizer; idempotent accelerator |
| `POST /checkout/stripe/webhook` | Raw signed provider event; invoke shared finalizer/release |
| `POST /checkout/paypal/order` | Validate, reserve, create pending order and PayPal order; return provider/internal IDs only |
| `POST /checkout/paypal/capture` | Capture using internal order ID; verify provider response; invoke shared finalizer |
| `GET /checkout/orders/:id/status` | Owner/guest-token protected minimal status/confirmation data |

Names may remain backward-compatible, but semantics must match this boundary.

### Conversation APIs after remediation

Prefer singular current-conversation routes because the product supports one continuous thread:

| Endpoint | Identity proof |
|---|---|
| `POST /queries/conversation` | Optional account auth; otherwise creates guest token |
| `GET /queries/conversation/messages` | Account auth or guest token |
| `POST /queries/conversation/messages` | Account auth or guest token |
| `GET /queries/conversation/unread-count` | Account auth or guest token |
| `PATCH /queries/conversation/read` | Account auth or guest token |

Admin routes remain role-protected and should add audit records for replies/read actions where useful.

## 7. Observability and reconciliation

### Required structured events

- `checkout.draft_created`
- `checkout.reservation_released`
- `payment.webhook_received`
- `payment.finalize_succeeded`
- `payment.finalize_duplicate`
- `payment.finalize_failed`
- `payment.reconciliation_started/completed`
- `order.email_queued/sent/failed`
- `auth.ownership_denied`
- `gateway.activated/rotated`

### Required operational views/alerts

- Paid provider transactions with no finalized order: target zero.
- Pending orders older than reservation TTL.
- Duplicate provider events and their no-op outcomes.
- Negative or oversold inventory prevention failures.
- Coupon reservation/usage mismatches.
- Outbox events exceeding retry threshold.
- Repeated conversation/order ownership failures by IP/account.
- No active or multiple active payment gateways.

### Reconciliation command behavior

The reconciliation tool must be safe to repeat and support dry-run:

1. Select unresolved pending/failed orders by age and provider.
2. Retrieve authoritative provider state.
3. Validate amount/currency/reference.
4. Invoke shared finalizer or release operation.
5. Record result and alert on mismatches.
6. Never print addresses, emails, tokens, or credentials.

## 8. Verification matrix

### Stripe

- [ ] Card success
- [ ] Card decline
- [ ] 3DS/redirect success and cancel
- [ ] Browser closes before provider response
- [ ] Browser closes after payment before application confirmation
- [ ] Webhook before browser confirmation
- [ ] Browser confirmation before webhook
- [ ] Duplicate and out-of-order webhooks
- [ ] Invalid signature
- [ ] DB unavailable before provider token is returned
- [ ] DB unavailable after payment; reconciliation repairs
- [ ] Amount/currency/order-reference mismatch

### PayPal

- [ ] Approval and capture success
- [ ] Approval cancelled
- [ ] Capture failure
- [ ] Capture response interrupted and retried
- [ ] Duplicate capture/finalization
- [ ] Client tampering attempt
- [ ] Correct provider capture ID stored
- [ ] Stock and coupon committed exactly once
- [ ] DB failure after capture; reconciliation repairs

### Inventory and coupons

- [ ] Last unit concurrency
- [ ] Multiple quantities across several products
- [ ] Reservation expiry and release
- [ ] Payment failure release
- [ ] Coupon final remaining global use
- [ ] Same customer reuse
- [ ] Same guest email/token reuse policy
- [ ] Concurrent coupon attempts

### Privacy and authorization

- [ ] Customer A vs Customer B order
- [ ] Customer A vs Customer B conversation
- [ ] Guest token correct/wrong/missing/revoked
- [ ] Arbitrary email/customer UUID rejected as identity
- [ ] Admin/store-manager/product-manager role matrix
- [ ] Inactive account rejected
- [ ] Minimal response snapshots contain no internal fields

### Session and browser

- [ ] Login/register/logout
- [ ] Access expiry and silent refresh
- [ ] Refresh rotation and replay rejection
- [ ] Concurrent tabs
- [ ] CSRF attempt
- [ ] XSS-relevant storage check
- [ ] CSP report-only then enforcement
- [ ] Direct route load/SSR/hydration
- [ ] Mobile checkout and support widget

## 9. Rollout plan

### Before deployment

- [ ] Reconcile live schema and back up data.
- [ ] Run pending migrations and post-apply checks in Supabase staging.
- [ ] Run complete automated matrix.
- [ ] Reconcile existing provider transactions and order rows.
- [ ] Pause or keep live gateways inactive during migration.
- [ ] Prepare rollback-compatible application version and database plan.

### Deployment order

1. Deploy backward-compatible database additions and functions.
2. Deploy backend capable of old read plus new write/finalization behavior where necessary.
3. Deploy frontend with new order/guest-token contracts.
4. Enable corrected webhooks and provider sandbox tests.
5. Run reconciliation in dry-run, then controlled apply.
6. Enable live gateways only after launch-gate evidence is signed off.
7. Remove obsolete columns/endpoints in a later migration, not the same release.

### Rollback principles

- Never roll back schema by dropping customer/payment data.
- Prefer forward fixes for migrations already applied.
- Keep finalization idempotent across old/new application versions during the deployment window.
- If payment integrity is uncertain, disable gateway activation/checkout and keep browsing/admin access available.
- Preserve provider event IDs and reconciliation evidence.

## 10. Definition of production-ready for this plan

The project may be reconsidered for production only when:

- CH-001 through CH-011, CH-013, CH-015 through CH-021, and CH-023 are `VERIFIED`, or a named P2 exception is explicitly accepted.
- Frontend lint is zero-error and CI is required.
- A clean environment can be created from migrations.
- Staging demonstrates exactly-once order effects under duplicate/concurrent callbacks.
- Cross-user/guest privacy tests pass.
- Successful provider transactions reconcile one-to-one with finalized orders.
- Monitoring and operational reconciliation are usable by the responsible operator.
- The selected deployment artifact starts and survives restart behind the production edge/proxy.
- A backup/restore and payment-reconciliation drill has been completed.

## 11. Progress log

Add concise evidence entries here; do not duplicate implementation detail already tracked above.

| Date | Defect | Status change | Evidence/notes |
|---|---|---|---|
| 2026-09-28 | CH-001–CH-014 | -> CONFIRMED | Repository inspection, backend typecheck pass, frontend build pass, lint baseline recorded |
| 2026-09-28 | CH-001 | CONFIRMED -> CODE COMPLETE | Raw route moved before JSON parser; 7/7 signature/middleware tests, build, and typecheck passed; staging acceptance pending |
| 2026-09-29 | CH-002 | CONFIRMED -> CODE COMPLETE | Supabase-first pending order, internal-ID redirects, protected polling, 10/10 backend tests, targeted frontend lint and production build passed; Supabase migration applied, staging pending |
| 2026-09-29 | CH-003 | CONFIRMED -> CODE COMPLETE | Atomic reservation/finalization/release RPCs, transaction-bound outbox, Stripe reconciliation, and PayPal atomic effects implemented; local checks passed; Supabase migrations applied with 12/12 object checks true; concurrency/staging/rollback verification pending |
| 2026-09-29 | CH-004 | CONFIRMED -> CODE COMPLETE | Trusted PayPal draft precedes provider order; browser checkout payload removed; ownership and exact provider capture verification added; 19/19 backend tests, frontend checks, 8/8 Supabase object checks, and rollback functional test passed; PayPal sandbox/concurrency verification pending |
| 2026-09-29 | CH-005 | CONFIRMED -> CODE COMPLETE | Session-derived customer ownership, hashed opaque guest tokens, singular current-conversation routes, minimal responses, direct-table lockdown, and dedicated rate limits implemented; 24/24 backend tests, frontend build, and targeted lint passed; migration and live cross-user tests pending |
| 2026-09-29 | CH-006 | CONFIRMED -> CODE COMPLETE | Existing owner/guest-token proof centralized and tested; guest token moved to a request header and scrubbed from browser history; PII removed from the minimal no-store response; 28/28 backend tests and frontend build passed; deployed privacy check pending |
| 2026-09-29 | CH-007 | CONFIRMED -> CODE COMPLETE | Atomic activation RPC, one-active partial unique index, actor audit, cache-free Stripe reads, masked admin responses, and blank-on-edit secrets implemented; 31/31 backend tests and frontend build passed; migration applied with 8/8 structural checks; live concurrency/rotation/browser verification pending |
| 2026-09-29 | CH-008 | CONFIRMED -> CODE COMPLETE | User auth and reset-email flows now use a required anon key while trusted backend operations retain the service-role client; 32/32 backend tests and frontend key-reference scan passed; backend anon key confirmed configured; deployed live-auth verification pending |
| 2026-09-29 | CH-009 | CONFIRMED -> CODE COMPLETE | Refresh token moved to a rotating HttpOnly cookie, access token moved to memory, legacy auth storage removed, exact-origin credentialed CORS enabled, and payment-aware CSP added report-only; 34/34 backend tests and frontend build passed; live browser/CSP enforcement verification pending |
| 2026-09-29 | CH-010 | PENDING -> IN PROGRESS | Live public-schema dump received and verified at `supabase/schema_dump.sql` (22 tables, 20 functions, 17 policies, no data rows/obvious secrets); baseline sanitization and clean reconstruction testing remain |
| 2026-09-29 | CH-011 | CONFIRMED -> IN PROGRESS | Deterministic pull-request/main CI for backend build plus 34 tests and frontend production build was committed/pushed as `f96f0ef`; database, frontend test/lint, browser E2E, and GitHub-run confirmation remain |
| 2026-09-29 | CH-012 | CONFIRMED -> CODE COMPLETE | Frontend lint reduced from the original 190 errors/18 warnings (135/17 at repair start) to 0/0; frontend build, backend build with 34/34 tests, and diff check passed; polling fake-timer and browser E2E coverage remain |
| 2026-09-29 | CH-013 | CONFIRMED -> PENDING | VPS deployment-target decision deferred by request; no implementation change made |
| 2026-09-30 | CH-014 | CONFIRMED -> CODE COMPLETE | Stale comments/config/docs corrected; feed status restricted to administrators; npm standardized to one frontend lockfile; frontend lint/build and backend 35/35 tests passed; compatibility endpoint and fixtures preserved |
| 2026-09-30 | CH-010 | IN PROGRESS -> CODE COMPLETE | Sanitized current-schema baseline, storage configuration, and safe Supabase adoption runbook added; static checks passed; migration-history alignment, storage migration, and post-apply checks remain |
| 2026-10-01 | CH-015–CH-023 | CONFIRMED -> CODE COMPLETE | Retry-safe Stripe handling, terminal-only PayPal release, order-bound gateways, checkout throttling, transactional coupon identity, frontend typecheck, backend lint, corrected migration docs, and dependency updates implemented; backend lint/build and 39/39 tests, frontend typecheck/lint/build, clean-install dry runs, and zero production audit findings passed; migration apply, provider sandboxes, concurrency, and GitHub-run confirmation remain |
| 2026-10-01 | CH-017, CH-019 | CODE COMPLETE | Forward migration confirmed on the configured Supabase target: zero orders and zero actionable orders lack `payment_gateway_id`; anonymous RPC execution is denied and service-role validation is reachable. Configured Stripe and PayPal gateways are live, so provider, rotation, and concurrency tests were not run there. |
| 2026-10-01 | CH-015, CH-018, CH-019 | CH-019 CODE COMPLETE -> VERIFIED | Authorized isolated verification passed: concurrent same-email coupon use allowed exactly one order; concurrent final-stock use prevented overselling; mismatched gateway binding was rejected; guest email was normalized; cleanup left zero temporary rows. A production-mode limiter returned `429` on request 11, and a locally signed Stripe failure webhook retained the retryable path without contacting Stripe. Live-provider and rotation tests remain pending. |

## 12. Sign-off

| Responsibility | Name | Decision/date |
|---|---|---|
| Engineering implementation | TBD | |
| Security/privacy review | TBD | |
| Payment reconciliation review | TBD | |
| Database migration review | TBD | |
| Staging acceptance | TBD | |
| Production release approval | TBD | |
