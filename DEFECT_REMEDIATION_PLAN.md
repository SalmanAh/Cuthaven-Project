# CutHaven Defect Remediation Plan

**Purpose:** Detailed implementation and tracking plan for confirmed defects and release risks  
**Code review baseline:** `main` at `bcd5df5`  
**Created:** 2026-09-28  
**Last updated:** 2026-09-28  
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
| CH-002 | P0 | CONFIRMED | Stripe can succeed without a database order; redirect fallback is invalid | Payments |
| CH-003 | P0 | CONFIRMED | Order finalization, stock, coupon, history, and email are not atomic/idempotent | Payments |
| CH-004 | P0 | CONFIRMED | PayPal capture trusts browser-returned order data and omits stock deduction | Payments |
| CH-005 | P0 | CONFIRMED | Customer-support routes do not enforce customer/guest ownership | Privacy |
| CH-006 | P0 | CONFIRMED | Public order summary exposes full order data by UUID | Privacy |
| CH-007 | P1 | CONFIRMED | Gateway activation and Stripe instance caching can select stale/ambiguous credentials | Configuration |
| CH-008 | P1 | CONFIRMED | “Anon” auth client uses the service-role key | Least privilege |
| CH-009 | P1 | CONFIRMED | Refresh tokens are stored in `localStorage`; frontend CSP is incomplete | Session security |
| CH-010 | P1 | CONFIRMED | Complete database migrations and RPC definitions are absent from version control | Reproducibility |
| CH-011 | P1 | CONFIRMED | No automated tests or CI release gate exists | Quality |
| CH-012 | P1 | CONFIRMED | Frontend lint fails with 190 errors and 18 warnings | Quality |
| CH-013 | P1 | CONFIRMED | Documented VPS frontend start command does not match the current build target | Deployment |
| CH-014 | P2 | CONFIRMED | Stale comments, deprecated endpoints/config, and public operational status create drift | Maintainability |

### Launch gate

Live checkout and production customer data remain blocked until:

- CH-001 through CH-006 are `VERIFIED`.
- CH-010 and CH-011 provide migrations and automated regression coverage for those fixes.
- CH-007 has a single-active-gateway invariant and credential refresh behavior.
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
- [ ] Implement gateway invariants/cache invalidation from CH-007.
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
**Status:** CONFIRMED  
**Dependencies:** CH-001, CH-003, CH-010  
**Affected paths:** checkout controller/routes, checkout frontend/API client, order confirmation page, database schema

### Evidence

- `createPaymentIntent()` creates no order and stores the draft in provider metadata.
- `confirmStripeOrder()` creates the order only after the browser reports success.
- The webhook searches for an existing `payment_transaction_id` and only updates it; it never inserts a missing order.
- `frontend/src/routes/checkout.tsx:592-601` catches confirmation failure and navigates using the PaymentIntent ID as `orderId`.
- `frontend/src/routes/order-confirmation.tsx` expects a database order ID, so that fallback cannot retrieve an order.
- `return_url` uses `piid`, but the confirmation route validates only `orderId`; redirect-based payment methods can land on the generic page.
- The confirmation page clears the cart on mount even when no confirmed order was loaded.

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
- [ ] Database insert fails before PaymentIntent is exposed; customer cannot pay that attempt.
- [ ] Database temporarily fails after provider success; reconciliation finalizes later.
- [ ] Payment failure releases reservation and retains cart.

### Acceptance criteria

- [ ] Every successful staging PaymentIntent maps to exactly one order.
- [ ] No confirmation request accepts a provider ID as an order identifier.
- [ ] Closing the browser cannot create a paid-but-missing order.
- [ ] Cart clearing occurs only after a verified confirmed order response.
- [ ] Staff can query unresolved payment attempts and reconciliation results.

## CH-003 — Finalization and commerce side effects are not atomic or idempotent

**Priority:** P0  
**Status:** CONFIRMED  
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
8. Return typed outcomes: `finalized`, `already_finalized`, `payment_mismatch`, `reservation_expired`, or `invalid_transition`.

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

- [ ] Database constraints and functions are version-controlled.
- [ ] No controller contains a per-item stock-decrement loop for finalization.
- [ ] Duplicate provider delivery returns 2xx and does not duplicate effects.
- [ ] An automated concurrency test covers stock and coupon limits.

## CH-004 — PayPal trusts browser checkout data and misses inventory effects

**Priority:** P0  
**Status:** CONFIRMED  
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

### Tests

- [ ] Tampered client total/items/address/coupon fields are impossible because capture accepts no such fields.
- [ ] Captured amount or currency mismatch stops finalization and alerts operations.
- [ ] Successful PayPal purchase changes inventory exactly once.
- [ ] Duplicate capture/finalization request returns the existing order.
- [ ] Coupon ownership/global limits behave identically to Stripe.
- [ ] DB failure after provider capture is recovered through reconciliation.

### Acceptance criteria

- [ ] `_checkoutData` no longer exists in frontend or backend contracts.
- [ ] PayPal and Stripe call the same order finalization boundary.
- [ ] Provider capture ID is uniquely stored.
- [ ] PayPal success passes stock/coupon concurrency tests.

## CH-005 — Customer-support ownership is not enforced

**Priority:** P0  
**Status:** CONFIRMED  
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
- [ ] Guest email without token grants no access.
- [ ] Wrong, expired, or revoked guest token returns 401/403.
- [ ] Admin role routes remain authorized and audited.
- [ ] Token hashes never appear in API responses/logs.
- [ ] Rate limiting blocks message spam without breaking ordinary polling.

### Acceptance criteria

- [ ] No public query handler trusts `customer_id`, `guest_email`, or `sender_id` as proof of ownership.
- [ ] Central ownership code covers every customer-side operation.
- [ ] Cross-user integration tests pass.
- [ ] Existing guests receive a documented migration/re-authentication behavior.

## CH-006 — Order summary exposes PII by order UUID

**Priority:** P0  
**Status:** CONFIRMED  
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

- [ ] Owner can retrieve order.
- [ ] Another authenticated customer receives 404 or 403 with no existence detail.
- [ ] Guest with correct token can retrieve minimal summary.
- [ ] Guest with only UUID cannot retrieve it.
- [ ] Wildcard database fields do not appear in response snapshots.
- [ ] Response has `Cache-Control: no-store`.

### Acceptance criteria

- [ ] Route has account ownership/guest-token proof.
- [ ] Response is explicitly typed and minimal.
- [ ] Confirmation UI works after redirect and page refresh.
- [ ] PII access tests pass.

## CH-007 — Gateway activation, cache, and secret responses are unsafe

**Priority:** P1  
**Status:** CONFIRMED  
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
- [ ] Updating a secret under the same row changes the next provider client used.
- [ ] Admin GET responses never contain complete secrets.
- [ ] Non-admin roles cannot reach gateway endpoints.
- [ ] Audit records identify actor/action but contain no credential material.

### Acceptance criteria

- [ ] Database enforces the invariant independently of application code.
- [ ] Credential rotation works without restart.
- [ ] Browser/network inspection shows no existing full secret.

## CH-008 — Supabase auth client violates least privilege

**Priority:** P1  
**Status:** CONFIRMED  
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

### Tests and acceptance

- [ ] Register, login, refresh, reset, logout, `requireAuth`, and inactive-user rejection pass.
- [ ] Anon auth client cannot perform privileged database/admin operations.
- [ ] Missing anon key fails startup with a clear message.
- [ ] No service-role value reaches client output or logs.

## CH-009 — Browser session tokens and CSP need hardening

**Priority:** P1  
**Status:** CONFIRMED  
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

### Tests and acceptance

- [ ] Refresh token is absent from JavaScript-visible storage and JSON responses.
- [ ] Cookie has HttpOnly, Secure, SameSite, and appropriate path attributes.
- [ ] Cross-site state-changing request without CSRF proof is rejected.
- [ ] Allowed frontend origins can authenticate; unlisted origins cannot.
- [ ] Token rotation, concurrent tabs, expiry, password reset, and logout pass.
- [ ] CSP enforcement does not break Stripe, PayPal, images, fonts, SSR, or hydration.

## CH-010 — Database schema and RPCs are not reproducible

**Priority:** P1  
**Status:** CONFIRMED  
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
6. Add database verification tests that build a disposable environment from zero.
7. Never use broad `DROP`/wipe operations against an existing environment during baseline adoption.

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
└── tests/                   SQL invariant tests
```

### Acceptance criteria

- [ ] A clean database can be created entirely from Git.
- [ ] Existing staging can adopt migrations without data loss.
- [ ] Functions, triggers, indexes, constraints, RLS, and storage policies are versioned.
- [ ] CI verifies migrations and core invariants.

## CH-011 — No automated tests or CI release gate

**Priority:** P1  
**Status:** CONFIRMED  
**Dependencies:** None; begin early  
**Affected paths:** backend/frontend packages, server entry, new test and CI files

### Evidence

- No real test/spec files exist.
- Backend starts listening during module import, making HTTP tests harder.
- Provider and database calls are embedded directly in controllers.

### Solution

1. Split `backend/src/app.ts` (`createApp`) from `backend/src/index.ts` (`listen`).
2. Add Vitest and Supertest for controller/middleware HTTP tests.
3. Extract Stripe/PayPal adapters and checkout service interfaces for deterministic fakes.
4. Add SQL/integration tests against a disposable Supabase/Postgres environment.
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

- [ ] CI runs on every pull request and main branch change.
- [ ] P0 tests fail against the old implementation and pass against the repair.
- [ ] Tests do not require live production credentials.
- [ ] Test logs contain no secrets or PII.

## CH-012 — Frontend lint fails

**Priority:** P1  
**Status:** CONFIRMED  
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

### Acceptance criteria

- [ ] `npm run lint` exits zero.
- [ ] No blanket rule disable was added.
- [ ] Query polling has fake-timer lifecycle tests.
- [ ] Checkout and authentication behavior still passes E2E tests.

## CH-013 — Frontend deployment target is inconsistent

**Priority:** P1  
**Status:** CONFIRMED  
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
**Status:** CONFIRMED  
**Dependencies:** Complete related P0/P1 behavior first

### Confirmed drift

- Checkout comments claim TaxJar behavior, while `calculateTax()` always returns zero tax.
- PayPal create-order comment says it stores a pending DB order, but it does not.
- PayPal client-ID endpoint is deprecated but still routed and callable.
- Deprecated payment environment variables remain despite database-only behavior.
- `/feed/status` is public even though its comment says future admin protection.
- Both Bun and npm frontend lockfiles exist.
- Gateway comments promise peer deactivation that implementation does not perform.

### Solution

1. Correct comments in the same changes that fix behavior.
2. Remove deprecated endpoints only after callers are migrated and compatibility is checked.
3. Remove unused env fields and update examples/deployment environments.
4. Protect operational status routes with appropriate staff roles or document why data is intentionally public.
5. Choose one frontend package manager and retain one lockfile.
6. Add a documentation/code checklist to pull-request templates.

### Acceptance criteria

- [ ] Source comments describe current behavior.
- [ ] No routed endpoint is labelled deprecated without an explicit removal plan.
- [ ] Environment schema contains only used variables.
- [ ] Deterministic install uses one frontend lockfile.

## 6. Proposed migration and API inventory

This is a planning inventory; exact SQL must be derived from the authoritative schema and reviewed before execution.

### Database migrations

| Migration | Main contents |
|---|---|
| Baseline | Current tables, types, FKs, indexes, functions, triggers, RLS, storage policies |
| Checkout integrity | Pending/reservation/finalization fields, transaction uniqueness, outbox, atomic RPCs |
| Conversation access | Guest token hash/rotation fields and indexes; remove unsafe assumptions |
| Gateway invariants | Partial unique active-gateway index and atomic activation/audit function |
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
- [ ] Run migrations in disposable environment and staging.
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

- CH-001 through CH-011 and CH-013 are `VERIFIED`, or a named P2 exception is explicitly accepted.
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

## 12. Sign-off

| Responsibility | Name | Decision/date |
|---|---|---|
| Engineering implementation | TBD | |
| Security/privacy review | TBD | |
| Payment reconciliation review | TBD | |
| Database migration review | TBD | |
| Staging acceptance | TBD | |
| Production release approval | TBD | |
