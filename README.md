# CutHaven Project Documentation

**Project:** CutHaven e-commerce platform  
**Market:** United States  
**Catalog:** Garden, outdoor and power tools, e-bikes, scooters, camping, and pool products  
**Repository:** `SalmanAh/Cuthaven-Project`  
**Last code/document review:** 2026-09-28

This is the primary project document. Detailed defect implementation and status tracking lives in [DEFECT_REMEDIATION_PLAN.md](DEFECT_REMEDIATION_PLAN.md). The implementation is the final source of truth when documentation and code disagree. Never place passwords, API secrets, payment credentials, customer data, private IP addresses, or access tokens here.

## 1. Executive summary

CutHaven is a full-stack TypeScript commerce application. It includes a server-rendered React storefront, a separate Express API, Supabase-backed authentication and data, Stripe and PayPal checkout, transactional email, Google Merchant Center feed generation, customer accounts, staff dashboards, content management, reviews, coupons, order tracking, and customer-support conversations.

The application is substantial and builds successfully, but must not yet be treated as fully production-ready. The highest-priority blockers are in [Known risks and required work](#15-known-risks-and-required-work), especially Stripe webhook/order reliability and missing ownership checks on customer-support and order-summary endpoints.

Verified repository health when this document was created:

| Check | Result |
|---|---|
| Backend `npm run typecheck` | Pass |
| Frontend `npm run build` | Pass |
| Frontend `npm run lint` | Fail: 190 errors and 18 warnings in 29 files |
| Automated test suite | None present |
| Git working tree before consolidation | Clean |
| Application source size | Approximately 28,166 lines across 179 TS/TSX files |

## 2. Architecture

```text
Customer or staff browser
        |
        v
TanStack Start frontend
React 19 + TanStack Router/Query + Tailwind/Radix
        |
        | HTTPS JSON API; Bearer token when authenticated
        v
Express API (/api/*)
        |
        +-- Supabase PostgreSQL, Auth, and Storage
        +-- Stripe
        +-- PayPal
        +-- Resend email
        +-- Google Merchant Center XML feed
```

Important boundaries:

- The frontend does not directly connect to Supabase. It uses the Express API through `frontend/src/lib/api-client.ts` and the dedicated queries client.
- The backend performs database operations with a Supabase service-role client. This bypasses RLS, so every backend handler must enforce authentication, roles, and record ownership itself.
- Supabase Auth supplies identity; application roles and active status come from `staff` and `customers`.
- Payment credentials are intended to come from `payment_gateways`. Checkout receives only publishable identifiers; secrets stay backend-only.
- Frontend and backend are separately built and deployed services.

## 3. Repository structure

```text
.
├── frontend/
│   ├── src/routes/            File-based pages
│   ├── src/components/        Layout, UI, dashboard, cart, and chat
│   ├── src/context/           Auth, cart, wishlist, and UI state
│   ├── src/lib/               API clients, SEO, errors, performance
│   ├── public/                Images, service worker, response headers
│   ├── package.json
│   └── vite.config.ts
├── backend/
│   ├── src/controllers/       API behavior
│   ├── src/routes/            Express routes
│   ├── src/middleware/        Auth, rate limits, caching, errors
│   ├── src/config/            Environment and external services
│   ├── src/emails/            Order and shipment emails
│   ├── src/lib/               Tax and XML helpers
│   ├── src/types/             Domain/API types
│   └── package.json
├── New Feature/               Historical customer-query SQL files
├── package.json               Development orchestrator
└── README.md                  This document
```

There is no canonical, complete database migration directory in this repository. Most SQL is ignored by `.gitignore`; only two historical query SQL files are present under `New Feature/`. A version-controlled schema/migration baseline is required for reproducible deployment.

## 4. Technology stack

### Frontend

- React 19.2
- TanStack Start, Router, and Query
- Vite 8 and TypeScript 5.8 strict mode
- Tailwind CSS 4 and Radix UI/shadcn-style components
- React Hook Form and Zod
- Stripe Elements and PayPal React SDK
- Recharts and Sonner
- Nitro output currently using the `cloudflare-module` preset supplied by the Lovable configuration package

### Backend

- Node.js ESM, Express 4, and TypeScript 5.8 strict mode
- Supabase JS 2 and Zod
- Stripe SDK, PayPal REST calls, and Resend
- Helmet, CORS, compression, Multer, and Express rate limiting

### Data and services

- Supabase PostgreSQL, Auth, and Storage
- Stripe and PayPal
- Resend transactional email
- Google Merchant Center scheduled XML feed

## 5. Implemented product areas

### Storefront

- Homepage, category promotions, and best sellers
- Product catalog, filters, and product details
- Cart drawer/page and local wishlist
- Stripe and PayPal checkout
- Confirmation and guest order tracking
- Registration, login, password recovery/reset
- Customer orders, profile, addresses, and password changes
- Blog, reviews, contact form, policy pages, cookie consent, sitemap, and SEO metadata
- Floating “Ask Questions” support widget

### Administration and staff

- Role-aware dashboards
- Order list/detail, fulfillment status, and payment status
- Product CRUD and image upload
- Customer lookup and staff management
- Analytics summary and revenue series
- Coupon CRUD, review moderation, and blog CRUD
- Payment-gateway CRUD and activation
- Customer conversations, replies, unread indicators, filters, and polling

### Roles

| Role | Main access |
|---|---|
| `customer` | Own profile, addresses, orders, reviews, checkout |
| `admin` | Full administration |
| `store_manager` | Orders, customers, analytics, blog reads, and queries as routes permit |
| `product_manager` | Products, orders, analytics, and queries as routes permit |

Backend middleware is the security boundary. Frontend guards are only a UX feature.

## 6. Data model

The current backend references these tables:

| Table | Purpose |
|---|---|
| `customers` | Customer profiles, state, and JSON addresses |
| `staff` | Staff profiles, roles, and active state |
| `categories` | Product categories |
| `products` | Catalog, pricing, stock, identifiers, and images |
| `orders` | Payment, addresses, totals, coupon, and fulfillment |
| `order_items` | Line-item snapshots |
| `order_status_history` | Fulfillment/status history |
| `coupons` | Discount rules and usage counters |
| `reviews` | Product reviews and moderation |
| `blog_posts` | Blog content |
| `contact_submissions` | Contact form data |
| `consent_log` | Cookie/privacy consent events |
| `payment_gateways` | Stripe/PayPal credentials and configuration |
| `feed_sync_log` | Product-feed generation history |
| `customer_conversations` | Customer/guest support threads |
| `conversation_messages` | Support messages |

Old documents also named carts, shipping policies, return policies, and staff audit logs, but the current backend does not reference them. Verify the live Supabase schema before relying on those historical tables.

### Historical catalog note

Earlier notes recorded a temporary 30-product seed selected from a 244-product WooCommerce export:

| Category | Recorded count |
|---|---:|
| Lawn & Garden | 10 |
| Electric Scooters | 7 |
| E-Bikes | 5 |
| Camping & Outdoors | 5 |
| Pool & Water | 3 |

The data was explicitly temporary because of catalog-quality concerns including marketplace content, questionable discount presentation, and missing identifiers. The live database was not inspected in this review, so these are historical counts, not guaranteed current inventory.

## 7. Authentication and sessions

Supported operations: register, login, logout, current-user lookup, forgot/reset password, and token refresh.

The frontend stores access token, refresh token, and a user snapshot in `localStorage`, refreshing on a 55-minute timer. Authenticated API calls use `Authorization: Bearer <token>`.

The backend verifies the token through Supabase, then looks in `staff` and `customers`. Inactive profiles and identities without an application profile are rejected.

Security consequence: `localStorage` increases the impact of XSS because scripts could steal the refresh token. Secure HTTP-only, SameSite cookie handling is recommended.

## 8. API map

Routes below are under `/api`. `GET /health` is at the server root.

### Authentication

| Method | Path | Access |
|---|---|---|
| POST | `/auth/register` | Public, rate-limited |
| POST | `/auth/login` | Public, strict rate limit |
| POST | `/auth/logout` | Authenticated |
| GET | `/auth/me` | Authenticated |
| POST | `/auth/forgot-password` | Public, strict rate limit |
| POST | `/auth/reset-password` | Public, strict rate limit |
| POST | `/auth/refresh` | Public, rate-limited |

### Catalog and content

| Method | Path | Access |
|---|---|---|
| GET | `/products` | Public |
| GET | `/products/:slug` | Public |
| GET | `/categories` | Public |
| GET | `/blog` | Public |
| GET | `/blog/categories` | Public |
| GET | `/blog/:slug` | Public |
| GET | `/reviews/:productSlug` | Public approved reviews |
| GET | `/reviews/can-review/:productId` | Authenticated |
| POST | `/reviews` | Customer |
| POST | `/contact` | Public |
| POST | `/consent` | Public |

### Customer and orders

| Method | Path | Access |
|---|---|---|
| GET/PATCH | `/customers/me` | Customer |
| POST | `/customers/me/change-password` | Customer |
| GET/PUT | `/customers/me/addresses` | Customer |
| GET | `/orders/my` | Customer; own orders |
| GET | `/orders/my/:id` | Customer; ownership checked |
| GET | `/orders/track` | Public; order number plus email |

### Checkout

| Method | Path | Access |
|---|---|---|
| GET | `/checkout/active-gateways` | Public configuration only |
| POST | `/checkout/validate-coupon` | Public/optional auth |
| POST | `/checkout/payment-intent` | Public/optional auth |
| POST | `/checkout/confirm-stripe-order` | Public/optional auth |
| POST | `/checkout/webhook` | Stripe signature required |
| GET | `/checkout/paypal/client-id` | Public |
| POST | `/checkout/paypal/create-order` | Public/optional auth |
| POST | `/checkout/paypal/capture-order` | Public/optional auth |
| GET | `/checkout/order/:id` | Public currently; must be hardened |

### Feed, uploads, and support

| Method | Path | Access |
|---|---|---|
| GET | `/feed/products.xml` | Public; cached 30 minutes |
| GET | `/feed/status` | Public currently |
| POST | `/upload/product-image` | Admin; 10 MB maximum |
| POST | `/queries/conversations` | Public currently |
| GET/POST | `/queries/conversations/:id/messages` | Public currently |
| GET | `/queries/unread-count` | Public currently |
| PATCH | `/queries/conversations/:id/read` | Public currently |

The support routes lack adequate ownership proof; see Section 15.

### Administration

All `/admin/*` routes require authentication, then role checks where defined:

- Orders: list, detail, order status, payment status
- Products: list and CRUD
- Customers: list and detail
- Staff: list, create, toggle active
- Analytics: summary and series
- Coupons: CRUD
- Reviews: list and moderate
- Blog: list and CRUD
- Queries: conversations, detail, reply, read state, unread count
- `/admin/payment-gateways`: list, detail, create, update, activate, delete

## 9. Checkout and order lifecycle

### Shared rules

- Backend prices and validates products; frontend totals are never trusted.
- Stock is checked before payment creation.
- Shipping is free from `$350.00`; otherwise `$9.99`.
- Tax currently returns `$0.00`, labelled `Tax-free`; no external tax service is active.
- Coupons support percentage/fixed discounts, minimums, expiry, total-use limits, and per-customer/per-email reuse checks.

### Stripe flow

1. Frontend submits product IDs, quantities, shipping, notes, and coupon.
2. Backend recalculates all totals.
3. Backend creates a Stripe PaymentIntent.
4. Shipping, totals, coupon ID, and line-item snapshots are put in PaymentIntent metadata.
5. Frontend confirms through Stripe Elements.
6. Frontend calls `/checkout/confirm-stripe-order` after success.
7. Backend retrieves the PaymentIntent, creates order/items, decrements stock, increments coupon use, and sends email.
8. A webhook is intended as the authoritative backup.

That backup is currently incomplete: it only updates an existing order and cannot create one if the browser never completes step 6. Raw webhook parsing is also incorrectly ordered. Do not process live Stripe payments until Section 15’s P0 work is resolved and tested.

### PayPal flow

1. Backend validates cart and retrieves active database credentials.
2. It creates a PayPal order and returns approval data plus checkout payload.
3. Frontend requests capture after approval.
4. Backend captures, creates order/items, and sends email.

PayPal needs the same retry, interruption, ownership, stock, coupon, and idempotency coverage as Stripe before launch.

## 10. Payment gateway management

Credentials are intended to be database-only:

- Stripe: secret, publishable, and webhook keys
- PayPal: client ID, client secret, and `sandbox`/`live` mode

Manage them at `/admin/payment-gateways`.

Rules:

- Never put payment secrets in frontend variables or use a `VITE_` prefix for them.
- Only Stripe publishable keys and PayPal client IDs may reach the browser.
- Separate test and live credentials.
- A production Stripe webhook secret differs from a Stripe CLI secret.
- Subscribe to `payment_intent.succeeded` and `payment_intent.payment_failed`.
- Example webhook: `https://api.example.com/api/checkout/webhook`.
- Code assumes one active gateway per type. The activation controller does not explicitly deactivate other rows; enforce this transactionally or with a verified DB constraint/trigger.
- The admin detail API returns full unmasked credentials for editing. Prevent caching/logging and protect admin access rigorously.

Checkout fails clearly when the database or active configuration is absent. Deprecated payment environment fields remain in the schema, but current Stripe and PayPal implementations use database configuration.

## 11. Customer-support conversations

The intended model is one continuous thread per registered customer or guest identity, not multiple tickets.

- Floating support button across the storefront
- Guest name/email held locally; accounts use customer identity
- 5,000-character message maximum
- Customer/admin unread counters and badges
- API polling; direct frontend Supabase realtime access was removed
- Admin, store-manager, and product-manager access to staff query routes
- Text only; no archive, resolution, deletion, attachments, typing indicators, or push notifications

Old documents treated RLS as the boundary. That is invalid now: Express uses the service-role client, so the backend must prove ownership for every conversation operation.

## 12. Responsive behavior and state

Tailwind breakpoints in use:

- Base/mobile: approximately 320–639 px
- `sm`: 640 px+
- `md`: 768 px+
- `lg`: 1024 px+

Responsive work covers navigation, footer, homepage, shop, product, cart, checkout, blog, dashboards, and chat. Do not claim WCAG AA compliance without an audit. Test keyboard navigation, focus, labels, contrast, zoom, reduced motion, announcements, and real devices.

Frontend state:

- Cart and wishlist: React contexts plus `localStorage`
- Authentication: context plus `localStorage`
- Server data: TanStack Query with five-minute stale time, ten-minute GC, one retry, and no focus refetch

## 13. Performance and platform controls

Verified implementation:

- Backend compression for responses over 1 KB
- Helmet and exact-origin CORS
- General and auth-specific rate limits
- Five-minute product cache; one-hour category/blog cache
- Thirty-minute in-memory GMC feed cache
- Frontend route/code splitting
- Immutable one-year headers for fingerprinted assets
- Optimized image/lazy-loading helpers and Web Vitals logging
- Production source maps disabled

Cautions:

- Build reports a roughly 544 KB uncompressed general vendor chunk plus large chart/route chunks.
- Nitro ignores some configured manual chunk settings.
- Vite now has native TypeScript path support, making `vite-tsconfig-paths` removable.
- Old performance numbers were estimates, not measurements. Establish real Lighthouse/Core Web Vitals baselines.

## 14. Local development

### Requirements and install

- Node.js 22+ recommended
- npm required for backend
- Root script uses Bun for frontend; npm also works inside `frontend/`
- Configured Supabase and environment files required for real API behavior

```bash
npm install
npm run install:all
```

Or:

```bash
cd backend && npm install
cd ../frontend && npm install
```

The frontend has both `bun.lock` and `package-lock.json`. Choose one frontend package manager to prevent drift.

### Environment and run

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
npm run dev
```

Or run `npm run dev` separately inside `backend/` and `frontend/`. Backend defaults to port 4000. Use the frontend URL printed by Vite rather than an old hardcoded port.

### Quality commands

```bash
cd backend
npm test
npm run typecheck
npm run build
```

```bash
cd frontend
npm run lint
npm run build
npm run preview
```

## 15. Known risks and required work

The file-by-file implementation strategy, migrations, test matrix, rollout plan, and status register for these items are maintained in [DEFECT_REMEDIATION_PLAN.md](DEFECT_REMEDIATION_PLAN.md).

### P0 — live-order blockers

1. **Stripe raw-body routing is code-complete; staging verification remains.** The webhook now mounts with route-scoped `express.raw()` before global JSON parsing, with signature/middleware regression coverage. See CH-001 in the remediation tracker.
2. **Webhook cannot create a missing paid order.** A successful payment followed by a closed browser can result in payment without an application order.
3. **Effects need idempotency.** Browser confirmation and webhook delivery can race/retry. Use a unique payment constraint and transaction/idempotency record so order, stock, coupon, history, and email happen exactly once. Stock can currently be attempted in both paths.
4. **Do not use provider metadata as the only order draft.** Persist a pending server-side draft and put only its stable reference in payment metadata.
5. **Run provider E2E tests.** Cover success, decline, duplicate/delayed webhook, invalid signature, browser close/retry, stock/coupon races, email failure, refund/failure, PayPal retry, and database interruption.

### P0 — authorization and privacy

1. **Query ownership is absent.** Public callers can submit arbitrary customer IDs/emails, read messages by conversation UUID, send to conversations, inspect unread state, and mark them read. Service-role access means RLS does not help. Require account ownership or a signed rotating guest token.
2. **Order summary is public by UUID and returns full rows.** Require customer ownership or a short-lived signed guest token and return an explicit minimal projection.
3. **Audit every public `supabaseAdmin` handler** for explicit authorization, ownership, and minimal response fields.

### P1 — release quality

1. Add tests for checkout/webhooks, auth/roles, ownership, conversations, coupons, products, and gateway activation.
2. Fix all 190 frontend lint errors and 18 warnings; review instead of blindly suppressing them.
3. Version the complete database schema: functions, constraints, indexes, triggers, RLS, storage, and seeds.
4. Add CI for deterministic install, backend typecheck/build, frontend lint/build, and tests.
5. Verify email with a production Resend domain and failure scenarios.
6. Validate catalog rights, content, GTIN/MPN, price/discount, stock, images, and Merchant compliance.

### P2 — security and maintainability

1. Move refresh-token handling to secure HTTP-only cookies where feasible.
2. `supabaseAuth` uses the service-role key despite comments calling it anon-level; use least privilege or correct the design/comments after review.
3. Make gateway activation transactional and guarantee one active row per type.
4. Consider application-level credential encryption or a secret manager; database-only is a source-of-truth choice, not complete secrets management.
5. Restrict `/feed/status` if operational data should not be public.
6. Add security logging, alerts, dependency scanning, restore testing, and rotation procedures.
7. Remove deprecated payment environment fields when compatibility is no longer needed.
8. Remove stale comments such as the nonexistent TaxJar integration description.

## 16. Environment variables

### Backend

Create `backend/.env` from the example.

| Variable | Required | Purpose |
|---|---:|---|
| `PORT` | No | Defaults to 4000 |
| `NODE_ENV` | No | `development`, `production`, or `test` |
| `FRONTEND_ORIGIN` | Yes | Exact comma-separated CORS origins; no trailing slash |
| `SUPABASE_URL` | Yes | Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Server-only privileged key |
| `STORE_URL` | No | Public store URL |
| `RESEND_API_KEY` | Production | Transactional email |
| `FROM_EMAIL` | No | Verified sender |
| `PAYPAL_CLIENT_ID/SECRET/MODE` | Deprecated | Active flow uses database values |
| `STRIPE_SECRET_KEY/WEBHOOK_SECRET` | Deprecated | Active flow uses database values |

```dotenv
PORT=4000
NODE_ENV=production
FRONTEND_ORIGIN=https://example.com,https://www.example.com
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=replace-with-server-only-secret
STORE_URL=https://example.com
RESEND_API_KEY=replace-with-resend-secret
FROM_EMAIL=CutHaven <orders@example.com>
```

### Frontend

```dotenv
VITE_API_URL=https://api.example.com/api
VITE_STORE_URL=https://example.com
```

Never add payment credentials to frontend environment files. Checkout fetches active public configuration from the backend.

## 17. Deployment guidance

### Resolve the frontend target first

Old guides assumed both services ran under PM2 on a Hostinger VPS. Current frontend output uses Nitro `cloudflare-module`, and `frontend/package.json` has no `start` script. The old `pm2 ... npm run start` instruction is invalid.

Choose and stage-test one model:

1. Deploy current frontend output to a compatible Cloudflare/Nitro environment and deploy Express separately.
2. For VPS-only, explicitly change Nitro to a Node-server target, add a supported start command, and verify it before placing both services behind Nginx/PM2.

### Backend

```bash
cd backend
npm ci
npm run typecheck
npm run build
NODE_ENV=production node dist/index.js
```

On a VPS, PM2 or systemd can supervise `dist/index.js`. Keep port 4000 private behind HTTPS/reverse proxy and preserve forwarded headers (`trust proxy = 1`).

### Frontend

```bash
cd frontend
npm ci
npm run lint
npm run build
```

Build emits `.output/` and reports `npx nitro deploy --prebuilt`. Validate it with the selected provider and staging first.

Intended DNS layout:

```text
example.com       -> frontend
www.example.com   -> frontend/canonical redirect
api.example.com   -> Express API
```

For VPS hosting, configure apex/`www`/`api` DNS, Nginx, TLS, and HTTP-to-HTTPS redirects. Use a non-root deployment user and scoped collaborator access; do not share hosting passwords in documentation.

After fixing webhook processing, register `payment_intent.succeeded` and `payment_intent.payment_failed`, store the production `whsec_...` in the active gateway, send signed tests, and verify exactly one order/stock/coupon/history/email effect.

Register the GMC scheduled feed at `https://api.example.com/api/feed/products.xml`, then validate landing pages, identifiers, price, availability, policies, images, and structured data.

## 18. Production checklist

### Code and data

- [ ] All P0 work in Section 15 complete
- [ ] Backend typecheck/build pass
- [ ] Frontend lint/build pass
- [ ] Automated integration tests pass
- [ ] Full migrations reproduce an empty database
- [ ] Backup and restore tested
- [ ] Production catalog verified

### Configuration and security

- [ ] No placeholders or committed secrets
- [ ] CORS contains only intended origins
- [ ] Service-role key is backend-only
- [ ] Staff accounts use least privilege
- [ ] Live payment credentials exist only in production
- [ ] Exactly one active gateway per enabled type
- [ ] Production Stripe endpoint and secret match
- [ ] Resend domain is verified
- [ ] HTTPS, headers, rate limits, and proxy verified

### Acceptance

- [ ] Auth and recovery flows work
- [ ] Catalog, cart, wishlist, and images work
- [ ] Customer profile/addresses/owned orders work
- [ ] Stripe and PayPal success/failure/interruption/retry work
- [ ] Coupons and stock remain correct under retries/concurrency
- [ ] Confirmation/shipping emails work
- [ ] Guest tracking requires order number and email
- [ ] Confirmation cannot expose another customer’s data
- [ ] Support conversations enforce ownership
- [ ] Staff role boundaries work
- [ ] GMC feed validates
- [ ] Mobile, desktop, keyboard, and screen-reader smoke tests pass

### Operations

- [ ] Health monitoring and centralized errors configured
- [ ] Deployment rollback tested
- [ ] TLS renewal tested
- [ ] Dependency scanning scheduled
- [ ] Private recovery contacts/procedures maintained

## 19. Update and rollback

1. Review code, environment, and schema changes.
2. Back up before schema/payment changes.
3. reproduce the release in staging.
4. Run typecheck, lint, build, and tests.
5. Apply forward-compatible migrations.
6. Deploy for the chosen target.
7. Run health/smoke checks and monitor logs.
8. Roll back only with a database-compatible plan; never use destructive Git commands against production data.

```bash
curl -i https://api.example.com/health
curl -i https://api.example.com/api/products
curl -i https://api.example.com/api/categories
curl -i https://api.example.com/api/feed/products.xml
```

Expected health shape: `{"status":"ok","env":"production"}`.

## 20. Troubleshooting

| Symptom | First checks |
|---|---|
| Frontend cannot reach API | API URL, health, DNS/TLS, network error, CORS |
| CORS failure | Exact scheme/host; apex and `www`; no trailing slash |
| No payment option | Active gateway rows and public config response |
| Stripe webhook 400 | Fix raw-body order, then endpoint secret/signature |
| Paid but no order | Known P0 defect; inspect provider/application logs and reconcile |
| Duplicate stock/email | Known idempotency risk; inspect retry/race processing |
| Email missing | Resend key/domain, backend logs, provider events |
| 401 | Expired token, refresh, missing application profile |
| 403 | Inactive account or wrong role |
| Chat polling issue | API response, effect dependencies, intervals, hook warnings |
| Stale frontend | CDN/provider cache, service worker, asset hashes |
| Feed missing products | Active product state, feed fields, logs, cache age |

## 21. Documentation rules

- Update this file with architecture, API, environment, deployment, or security changes.
- Record verified facts, not unsupported completion percentages or security scores.
- Do not create separate fix, verification, progress, or duplicate deployment Markdown files. The dedicated defect tracker is the sole exception.
- Keep historical implementation plans in Git history or issue tracking.
- Never include secrets, customer data, passwords, keys, credentials, or complete payment identifiers.
- Re-run verification before updating repository-health results.
