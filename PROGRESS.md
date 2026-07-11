# CutHaven — Development Progress Log

**Project:** CutHaven.com — GMC-compliant e-commerce store (US market, garden/outdoor/power tools)
**Built by:** Nauvara AI (Salman Ahmed) for client Jasim
**Stack:** TanStack Start (React 19) frontend · Express + TypeScript backend · Supabase (PostgreSQL) · Stripe

---

## Architecture

```
cuthaven/
├── frontend/     TanStack Start v1, React 19, Tailwind v4, shadcn/ui — port 8080
├── backend/      Express + TypeScript, Supabase service-role client — port 4000
├── package.json  Root orchestrator (concurrently runs both)
└── .gitignore    Ignores .env, *.md, *.sql, *.csv, node_modules, dist
```

**Key decisions:**
- Frontend never talks to Supabase directly — only calls backend HTTP API
- Backend uses two Supabase clients: `supabaseAdmin` (DB ops, service-role) + `supabaseAuth` (auth ops, prevents session pollution)
- All auth via Supabase Auth (JWT) + Express middleware verification
- Stripe hosted payment (SAQ A PCI scope — backend never sees raw card data)

---

## Session 1 — Infrastructure & Database

### Completed
- Monorepo structure established (`frontend/` + `backend/`)
- Git repository connected to `https://github.com/SalmanAh/Cuthaven-Project.git`
- `.gitignore` configured — ignores `.env`, `*.md`, `*.sql`, `*.csv`, `node_modules/`, `dist/`, Lovable internals
- **Supabase project provisioned** — old schema (Nature's Divine) fully wiped, new schema applied
- **Database schema live** — 16 tables: `staff`, `staff_audit_log`, `customers`, `consent_log`, `categories`, `shipping_policies`, `return_policies`, `products`, `feed_sync_log`, `carts`, `coupons`, `orders`, `order_items`, `order_status_history`, `reviews`, `contact_submissions`
- RLS enabled on all tables
- Backend boots cleanly — `GET /health` → `{"status":"ok"}`

### Backend env variables configured
```
PORT, NODE_ENV, FRONTEND_ORIGIN, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
```

---

## Session 2 — Authentication System

### Backend — new files
| File | Purpose |
|---|---|
| `src/types/auth.ts` | `AuthUser`, `AuthResponse` types |
| `src/middleware/requireAuth.ts` | JWT verification, `requireAuth`, `requireRole`, `optionalAuth` |
| `src/controllers/auth.controller.ts` | register, login, logout, me, forgotPassword, resetPassword, refreshToken |
| `src/routes/auth.routes.ts` | All auth routes, public vs protected split |

### Auth endpoints
```
POST /api/auth/register        — creates Supabase auth user + customers row
POST /api/auth/login           — returns { user, accessToken, refreshToken }
POST /api/auth/logout          — server-side session invalidation
GET  /api/auth/me              — returns current user (requireAuth)
POST /api/auth/forgot-password — sends Supabase reset email
POST /api/auth/reset-password  — verifies reset tokens, updates password
POST /api/auth/refresh         — exchanges refresh token for new access token
```

### Critical fix — Supabase client separation
Supabase JS client is stateful. Calling `signInWithPassword` on the admin client mutates its internal session, causing subsequent DB queries to run as the user (not service-role) → RLS blocks them. Fixed by using two separate client instances:
- `supabaseAdmin` — DB queries only, always service-role
- `supabaseAuth` — auth operations only (signIn, resetPassword, refreshSession)

### Frontend — new files
| File | Purpose |
|---|---|
| `src/context/AuthContext.tsx` | Auth state, localStorage persistence, auto token refresh (55-min timer) |
| `src/components/auth/RequireAuth.tsx` | Route guard with role support + loading spinner |

### Frontend — modified files
- `account.login.tsx` — real API call, error display, redirect-after-login, redirects away if already logged in
- `account.register.tsx` — real API call, full validation, password strength, redirects if logged in
- `account.forgot-password.tsx` — wired to real API
- `account.reset-password.tsx` — reads hash tokens from Supabase reset link URL
- `__root.tsx` — `AuthProvider` added to provider tree
- `admin.dashboard.tsx` — `RequireAuth roles={["admin"]}` guard + real logout
- `store-manager.dashboard.tsx` — `RequireAuth roles={["store_manager"]}` guard + real logout
- `account.dashboard.tsx` — `RequireAuth roles={["customer"]}` guard + real logout
- `components/layout/Header.tsx` — shows logged-in user with avatar/dropdown (My Account + Sign Out) when authed; Login/Register when not

### Session maintenance
- JWT stored in `localStorage` (`ch-access-token`)
- Refresh token stored (`ch-refresh-token`)
- Auto-refresh timer fires 55 min after login, silently swaps token pair, chains next refresh
- On refresh failure (long-expired token) → auto-logout

---

## Session 3 — Customer Dashboard (Real Data)

### Backend — new files
| File | Purpose |
|---|---|
| `src/types/order.ts` | `Order`, `OrderItem`, `PublicOrder` types + `toPublicOrder()` mapping |
| `src/controllers/orders.controller.ts` | `GET /api/orders/my`, `GET /api/orders/my/:id` (ownership-checked) |
| `src/controllers/customers.controller.ts` | Profile, addresses (CRUD), change password |
| `src/routes/orders.routes.ts` | Customer order routes behind `requireAuth + requireRole("customer")` |
| `src/routes/customers.routes.ts` | Customer profile/address routes behind auth + role |

### Customer endpoints
```
GET    /api/orders/my              — all customer orders (newest first)
GET    /api/orders/my/:id          — single order (ownership check)
GET    /api/customers/me           — profile: name, email, phone, addresses
PATCH  /api/customers/me           — update name/phone
POST   /api/customers/me/change-password — verifies current password first
GET    /api/customers/me/addresses — address array from customers.addresses jsonb
PUT    /api/customers/me/addresses — replace full addresses array
```

### Frontend — account dashboard rewritten
All mock data replaced with real API calls:
- Overview: real order count, real address count, real recent orders
- My Orders: real `useQuery`, detail dialog with line items/totals/shipping
- Addresses: real `useMutation` — add/edit/delete persist to DB
- Profile: real name/phone update, email shown but disabled
- Change Password: calls backend, verifies current password first
- `StatusBadge` extended to handle both DB lowercase and mock Title Case statuses

---

## Session 4 — Categories, Checkout & Stripe

### Backend — new files
| File | Purpose |
|---|---|
| `src/types/category.ts` | `Category`, `PublicCategory` types |
| `src/controllers/categories.controller.ts` | `GET /api/categories` with live product count |
| `src/routes/categories.routes.ts` | Public, no auth |
| `src/config/stripe.ts` | Single shared Stripe instance (`2025-02-24.acacia`) |
| `src/controllers/checkout.controller.ts` | `createPaymentIntent`, `stripeWebhook`, `getOrderSummary` |
| `src/routes/checkout.routes.ts` | Webhook uses raw body parser for Stripe signature verification |

### Checkout flow
```
1. Frontend validates billing form
2. POST /api/checkout/payment-intent
   - Fetches live product prices from DB (never trusts frontend prices)
   - Validates stock availability
   - Calculates subtotal + shipping ($0 if ≥$350, else $9.99) + tax (0 for now)
   - Creates Stripe PaymentIntent
   - Saves pending order + order_items to DB
   - Returns { clientSecret, orderId, orderNumber, total }
3. Frontend renders Stripe <PaymentElement>
4. User pays → Stripe processes
5. Stripe webhook fires → order status: pending → confirmed, payment_status → paid
6. Frontend redirects to /order-confirmation?orderId=...
7. Confirmation page fetches real order data from GET /api/checkout/order/:id
```

### Stripe webhook (local dev)
- Stripe CLI installed and configured
- `stripe listen --forward-to http://localhost:4000/api/checkout/webhook`
- Webhook secret saved to `STRIPE_WEBHOOK_SECRET` in `backend/.env`
- Verified: `payment_intent.succeeded` → order status flips to `confirmed` ✅

### Frontend — modified
- `api-client.ts` — added `getCategories()`, `createPaymentIntent()`, `getOrderSummary()`
- `shop.tsx` — category filter uses real `/api/categories`
- `checkout.tsx` — full Stripe integration, `Field` component moved to top-level (fixes focus-loss bug)
- `order-confirmation.tsx` — shows real order data (items, totals, shipping address)
- `index.tsx` (homepage) — best sellers + category tiles use real API data
- `product.$slug.tsx` — PDP rewritten to fetch from real API (was causing 404 on all real products)

### Bug fixes
- **Form focus-loss bug** — `Field` and `PwField` were defined inside parent components, causing remount on every keystroke. Moved both to top-level module scope.
- **`product_image` column mismatch** — checkout controller was inserting `product_image_url` but DB column is `product_image`. Fixed.
- **`optionalAuth` middleware** — checkout endpoint now reads token if present (links order to logged-in customer) but still works for guests.

---

## Session 5 — Seed Data

### 30 products seeded across 5 categories
Source: `https___gravixco_com_woocommerce.csv` (Jasim's WooCommerce export from gravixco.com)

Selection criteria:
- No Amazon HTML in description
- No Amazon CDN images (`_AC_SL1500_`)
- Has sale price and images
- Sale price used as real price (`compare_at_price: null`) — avoids fake discount issue

| Category | Products |
|---|---|
| Lawn & Garden | 10 |
| Electric Scooters | 7 |
| E-Bikes | 5 |
| Camping & Outdoors | 5 |
| Pool & Water | 3 |

**⚠️ TEMPORARY** — replace with Jasim's verified catalog once brand/GTIN/pricing questions are resolved.

---

## Known Gaps (not done, by design)

| Gap | Notes |
|---|---|
| RLS policies | Backend uses service-role key (bypasses RLS). Add proper policies before going live with real customer data |
| Admin dashboard real data | All mock — needs backend endpoints for orders/products/customers CRUD |
| Store manager dashboard real data | All mock |
| Email notifications | No order confirmation email — needs Resend/SendGrid integration |
| Stripe webhook (production) | Works locally via CLI. In production: Stripe Dashboard → Webhooks → point to `https://domain.com/api/checkout/webhook` → save new `STRIPE_WEBHOOK_SECRET` |
| Tax calculation | `tax_amount: 0` hardcoded. Needs TaxJar/Avalara integration |
| GMC feed generation | `feed_sync_log` table exists, no code writes to it yet |
| Merchant API sync | Not started — build against Merchant API v1 (Content API sunsets Aug 18 2026) |
| JSON-LD structured data | Must be server-rendered on PDPs for Google to crawl |
| Product catalog (Jasim) | 244 WooCommerce products have issues (Amazon content, fake discounts, missing GTINs). Blocked on client response |
| PayPal payment method | Stripe only for now |
| Reviews system | `reviews` table exists, no endpoints or UI wired |
| Blog backend | Static mock data only |
| Contact form backend | Frontend submits locally, no DB write |

---

## Deployment Notes

- `STRIPE_WEBHOOK_SECRET` must be updated to the production webhook secret (different from dev CLI secret)
- Set Stripe account payout currency to USD (currently EUR)
- Run `cuthaven_db_schema.sql` on production Supabase if migrating DB
- Add RLS policies before exposing any customer data
- Set `NODE_ENV=production` — error handler returns generic messages in production
