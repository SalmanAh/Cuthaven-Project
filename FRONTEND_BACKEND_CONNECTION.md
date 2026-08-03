# 🔗 Frontend ↔ Backend Connection Guide

**Last Updated:** July 30, 2026

---

## ✅ **Answer: Connection is in ENV (NOT Hardcoded)**

The frontend connects to the backend via the **`VITE_API_URL`** environment variable.

---

## 📍 **Step-by-Step Connection Flow**

### **1. Environment Variable (Configuration)**

```plaintext
File: frontend/.env

VITE_API_URL=http://localhost:4000/api
            ↑
            This tells the frontend WHERE the backend is
```

---

### **2. API Client (Uses the ENV Var)**

```typescript
File: frontend/src/lib/api-client.ts (Line 4)

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000/api";
                ↑                                  ↑
                Reads from .env                    Fallback if env missing
```

**Key Points:**
- ✅ `import.meta.env.VITE_API_URL` reads from `.env` file
- ✅ In Vite, env vars MUST start with `VITE_` to be accessible in frontend
- ✅ Fallback exists but env var always wins

---

### **3. Request Function (Makes API Calls)**

```typescript
File: frontend/src/lib/api-client.ts (Lines 18-44)

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
                           ↑        ↑
                           Uses     Endpoint path
                           env var  
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  return res.json() as Promise<T>;
}
```

**Example Calls:**
```typescript
// When you call:
await request<Products>("/products");

// It fetches:
http://localhost:4000/api/products
↑                          ↑
From VITE_API_URL          Path parameter
```

---

### **4. All API Functions Use This Base**

```typescript
File: frontend/src/lib/api-client.ts

// Products
export async function getProducts() {
  return request<Products>("/products");
  // Calls: http://localhost:4000/api/products
}

// Blog
export async function getBlogPosts() {
  return request<BlogPosts>("/blog");
  // Calls: http://localhost:4000/api/blog
}

// Checkout
export async function createPaymentIntent(data: CheckoutData) {
  return request<PaymentIntent>("/checkout/create-payment-intent", {
    method: "POST",
    body: data,
  });
  // Calls: http://localhost:4000/api/checkout/create-payment-intent
}

// ALL API functions use the same API_URL from .env
```

---

## 🔧 **Full Connection Diagram**

```
┌─────────────────────────────────────────────────────────────────────┐
│                         FRONTEND (.env)                             │
│  VITE_API_URL=http://localhost:4000/api                             │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             │ Vite reads at build time
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   frontend/src/lib/api-client.ts                    │
│  const API_URL = import.meta.env.VITE_API_URL                       │
│                  ↓                                                   │
│  function request(path) {                                            │
│    fetch(`${API_URL}${path}`)  // Combines base + path              │
│  }                                                                   │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             │ HTTP Request
                             │
                ┌────────────┴────────────┐
                │                         │
                ▼                         ▼
    /products endpoint          /checkout/create-payment-intent
                │                         │
                └────────────┬────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        BACKEND (Express)                            │
│  Listening on: http://localhost:4000                                │
│  Routes:                                                             │
│    GET  /api/products                                                │
│    GET  /api/blog                                                    │
│    POST /api/checkout/create-payment-intent                          │
│    GET  /api/checkout/active-gateways                                │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 📊 **Environment Variables: Dev vs Production**

### **Development (Current):**

```plaintext
Frontend .env:
  VITE_API_URL=http://localhost:4000/api
  ↓
  Frontend calls: http://localhost:4000/api/products
  ↓
  Backend receives request on port 4000 ✅

Backend .env:
  PORT=4000
  FRONTEND_ORIGIN=http://localhost:8080  (CORS - who can call us)
```

---

### **Production (When Deploying):**

```plaintext
Frontend .env:
  VITE_API_URL=https://api.cuthaven.com/api
  ↓
  Frontend calls: https://api.cuthaven.com/api/products
  ↓
  Backend receives request on production server ✅

Backend .env:
  PORT=4000  (or whatever your hosting provides)
  FRONTEND_ORIGIN=https://www.cuthaven.com  (CORS - allow production domain)
```

---

## 🔍 **How to Verify the Connection**

### **Method 1: Check Browser Network Tab**

1. Open frontend in browser: `http://localhost:8080`
2. Open DevTools (F12)
3. Go to **Network** tab
4. Reload page
5. Look for requests to `localhost:4000/api/products`

**Example:**
```
Request URL: http://localhost:4000/api/products
Request Method: GET
Status Code: 200 OK
```

---

### **Method 2: Check Frontend Code**

```bash
# Search for all uses of API_URL
cd /home/mbappe/Cuthaven-Project/frontend
grep -r "API_URL" src/

# Output shows:
# src/lib/api-client.ts:4:const API_URL = import.meta.env.VITE_API_URL
```

---

### **Method 3: Check Build Output**

```bash
cd /home/mbappe/Cuthaven-Project/frontend
npm run build

# Vite will show:
# transforming (1234) src/lib/api-client.ts
# ✓ built in 2.34s
```

During build, Vite **replaces** `import.meta.env.VITE_API_URL` with the actual value from `.env`.

---

## 🎯 **Key Points**

### **✅ NOT Hardcoded:**
```typescript
// ❌ BAD (Hardcoded):
const API_URL = "http://localhost:4000/api";

// ✅ GOOD (From .env):
const API_URL = import.meta.env.VITE_API_URL;
```

### **✅ Configurable per Environment:**
```plaintext
Development:
  frontend/.env → VITE_API_URL=http://localhost:4000/api
  
Production:
  frontend/.env → VITE_API_URL=https://api.cuthaven.com/api
  
Different values, same code!
```

### **✅ Single Source:**
```plaintext
All API calls go through:
  frontend/src/lib/api-client.ts

Change VITE_API_URL once → affects all API calls
```

---

## 🔐 **Security Note**

### **Frontend ENV Vars are PUBLIC:**

```plaintext
⚠️ IMPORTANT: Frontend .env vars are embedded in the JavaScript bundle

VITE_API_URL=http://localhost:4000/api
↓
Anyone can see this in browser DevTools!

DO NOT PUT SECRETS IN FRONTEND .ENV:
  ❌ VITE_DATABASE_PASSWORD=...    (NEVER!)
  ❌ VITE_STRIPE_SECRET_KEY=...    (NEVER!)
  ✅ VITE_API_URL=...               (Safe - it's public anyway)
  ✅ VITE_STORE_URL=...             (Safe - it's public anyway)
```

**Why This is OK:**
- `VITE_API_URL` just points to your backend
- Backend has authentication/authorization
- Secrets stay on backend (database, env vars there)

---

## 🛠️ **How to Change Connection**

### **Scenario 1: Change Backend Port**

```bash
# 1. Change backend port
# backend/.env
PORT=5000  # Changed from 4000

# 2. Update frontend to match
# frontend/.env
VITE_API_URL=http://localhost:5000/api  # Changed from 4000

# 3. Restart both servers
```

---

### **Scenario 2: Point to Different Backend**

```bash
# Point frontend to staging backend
# frontend/.env
VITE_API_URL=https://staging-api.cuthaven.com/api

# Now frontend calls staging instead of local!
```

---

### **Scenario 3: Use Multiple Backends**

```bash
# Create multiple env files:
frontend/
  .env.local        → http://localhost:4000/api
  .env.staging      → https://staging-api.cuthaven.com/api
  .env.production   → https://api.cuthaven.com/api

# Then copy the one you want:
cp .env.local .env       # For local dev
cp .env.production .env  # For production build
```

---

## 📝 **Complete Example: API Call Journey**

### **User clicks "Shop" button:**

```typescript
// 1. Component calls API function
// File: frontend/src/routes/shop.tsx
const products = await getProducts();

// 2. API function uses request helper
// File: frontend/src/lib/api-client.ts
export async function getProducts() {
  return request<Products>("/products");
}

// 3. Request helper reads API_URL from env
// File: frontend/src/lib/api-client.ts
const API_URL = import.meta.env.VITE_API_URL;  // "http://localhost:4000/api"

async function request(path) {
  const res = await fetch(`${API_URL}${path}`);
  //                      ↓           ↓
  //         "http://localhost:4000/api" + "/products"
  //         = "http://localhost:4000/api/products"
  return res.json();
}

// 4. Browser makes HTTP request
GET http://localhost:4000/api/products

// 5. Backend receives request
// File: backend/src/routes/products.routes.ts
router.get("/", async (req, res) => {
  const products = await getProductsFromDatabase();
  res.json({ products });
});

// 6. Backend sends response
{ "products": [ { "id": "123", "name": "Lawn Mower", ... } ] }

// 7. Frontend receives data
// 8. Component renders products
```

---

## ✅ **Summary**

| Question | Answer |
|----------|--------|
| **Is connection hardcoded?** | ❌ NO - Uses `VITE_API_URL` env var |
| **Where is URL defined?** | ✅ `frontend/.env` |
| **Which file uses it?** | ✅ `frontend/src/lib/api-client.ts` |
| **How is it accessed?** | ✅ `import.meta.env.VITE_API_URL` |
| **Can it be changed?** | ✅ YES - Edit `.env` and restart |
| **Different per environment?** | ✅ YES - Dev uses localhost, prod uses domain |
| **Is it secure?** | ✅ YES - Frontend env vars can be public |

---

## 🎯 **Current Configuration**

```plaintext
Frontend:
  File: /home/mbappe/Cuthaven-Project/frontend/.env
  Value: VITE_API_URL=http://localhost:4000/api
  
Backend:
  File: /home/mbappe/Cuthaven-Project/backend/.env
  Value: PORT=4000
  
Connection Status: ✅ CONFIGURED CORRECTLY
```

---

**Need to change the connection? Just edit `VITE_API_URL` in frontend `.env`!** 🎉
