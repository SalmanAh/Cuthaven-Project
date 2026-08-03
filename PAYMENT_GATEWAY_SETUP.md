# 💳 Payment Gateway Setup Guide

## Overview

CutHaven uses a **database-driven payment gateway system** that allows admins to manage Stripe and PayPal credentials without code changes or deployments.

---

## ✅ FIXES APPLIED

### 1. **Removed Hardcoded Keys from Frontend**
- ❌ **OLD:** `VITE_STRIPE_PUBLISHABLE_KEY` in `frontend/.env`
- ✅ **NEW:** Keys fetched dynamically from `/api/checkout/active-gateways`

### 2. **Fixed Backend CORS Configuration**
- ❌ **OLD:** `FRONTEND_ORIGIN=http://localhost:8080` (would block production)
- ✅ **NEW:** `FRONTEND_ORIGIN=https://www.cuthaven.com`

### 3. **Updated Documentation**
- Added warnings to `.env.example` files
- Clarified that payment keys come from database
- Marked env vars as deprecated fallback

---

## 🗄️ Database Table Verification

### Check if `payment_gateways` Table Exists

Run this in your Supabase SQL Editor:

```sql
SELECT * FROM payment_gateways LIMIT 1;
```

**If you get "relation does not exist" error**, run the migration below.

---

## 🚀 Payment Gateway Migration SQL

**Only run this if the table doesn't exist:**

```sql
-- ═══════════════════════════════════════════════════════════════════════════
-- Payment Gateways Table — Dynamic Payment Configuration
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS payment_gateways (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gateway_type VARCHAR(20) NOT NULL CHECK (gateway_type IN ('stripe', 'paypal')),
  account_name VARCHAR(100) NOT NULL,  -- e.g., "Main Stripe Account"
  is_active BOOLEAN NOT NULL DEFAULT false,
  
  -- Stripe fields (NULL for PayPal gateways)
  stripe_secret_key TEXT,              -- sk_live_... or sk_test_...
  stripe_publishable_key TEXT,         -- pk_live_... or pk_test_...
  stripe_webhook_secret TEXT,          -- whsec_...
  
  -- PayPal fields (NULL for Stripe gateways)
  paypal_client_id TEXT,
  paypal_client_secret TEXT,
  paypal_mode VARCHAR(10) CHECK (paypal_mode IN ('sandbox', 'live')),
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES staff(id) ON DELETE SET NULL,
  
  -- Ensure account name is unique per gateway type
  UNIQUE(gateway_type, account_name)
);

-- Index for fast lookups by active status
CREATE INDEX IF NOT EXISTS idx_payment_gateways_active 
ON payment_gateways(gateway_type, is_active) 
WHERE is_active = true;

-- Enable Row Level Security
ALTER TABLE payment_gateways ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Only admins can read/write
CREATE POLICY "Admin full access" ON payment_gateways
  FOR ALL
  USING (auth.uid() IN (
    SELECT auth_id FROM staff WHERE role = 'admin' AND is_active = true
  ));

COMMENT ON TABLE payment_gateways IS 
  'Dynamic payment gateway configuration. Admin can add/activate multiple Stripe/PayPal accounts without code changes.';
```

---

## 🎯 Setup Instructions

### Step 1: Verify Database Table

```sql
-- Check if table exists
SELECT COUNT(*) FROM payment_gateways;

-- List all payment gateways
SELECT 
  id, 
  gateway_type, 
  account_name, 
  is_active,
  created_at
FROM payment_gateways
ORDER BY gateway_type, is_active DESC;
```

### Step 2: Add Your First Payment Gateway

#### Option A: Via Admin Panel (Recommended)

1. Visit: `http://localhost:8080/admin/payment-gateways` (dev) or `https://www.cuthaven.com/admin/payment-gateways` (prod)
2. Click "Add New Gateway"
3. Select gateway type (Stripe or PayPal)
4. Enter credentials
5. Click "Activate" to make it live

#### Option B: Via SQL (Quick Test)

**Add Stripe Gateway:**
```sql
INSERT INTO payment_gateways (
  gateway_type,
  account_name,
  stripe_secret_key,
  stripe_publishable_key,
  stripe_webhook_secret,
  is_active
) VALUES (
  'stripe',
  'Live Stripe Account',
  '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',
  'pk_live_51RUA74IOgrNgG5cQrQZ5RDUIyLIK7upffPbpDtbqixcY1bvP90pWC3YbkhYpHc7k9l0HsFQWkpViEmdrTlvJv3le00htMZ10Ts',
  'whsec_ca8c0d2e9ebf1fd001659346baa3fac01ea3d8bc740c90aa2b0800c6bf200426',
  true  -- ✅ Active
);
```

**Add PayPal Gateway (when ready):**
```sql
INSERT INTO payment_gateways (
  gateway_type,
  account_name,
  paypal_client_id,
  paypal_client_secret,
  paypal_mode,
  is_active
) VALUES (
  'paypal',
  'Live PayPal Account',
  'YOUR_PAYPAL_CLIENT_ID',
  'YOUR_PAYPAL_CLIENT_SECRET',
  'live',
  true
);
```

### Step 3: Verify Checkout Integration

1. Clear browser cache: `Ctrl+Shift+Delete`
2. Visit checkout page: `/checkout`
3. You should see:
   - ✅ Stripe card payment option (if Stripe gateway active)
   - ✅ PayPal button (if PayPal gateway active)
   - ✅ Cash on Delivery (always available)

---

## 🔍 Troubleshooting

### Problem: "No payment methods available" on checkout

**Solution:**
```sql
-- Check active gateways
SELECT * FROM payment_gateways WHERE is_active = true;

-- If none, activate one:
UPDATE payment_gateways 
SET is_active = true 
WHERE gateway_type = 'stripe'
LIMIT 1;
```

### Problem: Stripe button not showing

**Check:**
1. Gateway is active in database
2. `stripe_publishable_key` is not null
3. Browser console for errors
4. Backend logs for API errors

**Debug:**
```bash
# Backend logs
cd backend && npm run dev

# Frontend console
# Open DevTools → Network tab → Filter by "active-gateways"
# Response should show: { "stripe": { "publishableKey": "pk_live_..." } }
```

### Problem: CORS error on checkout

**Cause:** `FRONTEND_ORIGIN` in `backend/.env` doesn't match your frontend URL

**Fix:**
```bash
# Development
FRONTEND_ORIGIN=http://localhost:8080

# Production
FRONTEND_ORIGIN=https://www.cuthaven.com  # NO trailing slash!
```

---

## 🔐 Security Best Practices

### ✅ DO:
- Store payment keys in database (encrypted at rest by Supabase)
- Manage gateways via admin panel
- Use separate test/live gateway records for dev/prod
- Regularly rotate webhook secrets

### ❌ DON'T:
- Commit `.env` files to git (already in `.gitignore`)
- Share service-role keys
- Expose secret keys to frontend
- Hardcode payment credentials in code

---

## 📋 Pre-Launch Checklist

- [ ] `payment_gateways` table exists in production database
- [ ] At least one Stripe gateway is active
- [ ] Stripe webhook registered in Stripe Dashboard
- [ ] Webhook secret matches database record
- [ ] Test transaction completed successfully
- [ ] PayPal gateway configured (if using PayPal)
- [ ] Backend `FRONTEND_ORIGIN` matches live domain
- [ ] Frontend has NO hardcoded payment keys
- [ ] Admin can access `/admin/payment-gateways`

---

## 📞 Support

**Common Issues:**

1. **"Failed to load payment options"** → Backend not running or CORS misconfigured
2. **Payment button missing** → Gateway not active in database
3. **Payment fails silently** → Check Stripe Dashboard logs
4. **Webhook not firing** → Verify webhook secret and endpoint URL

**Need Help?** Check:
- Backend logs: `cd backend && npm run dev`
- Frontend console: Browser DevTools → Console tab
- Stripe Dashboard: https://dashboard.stripe.com/logs
- Supabase logs: Dashboard → Database → Logs

---

**Last Updated:** August 1, 2026  
**System Version:** CutHaven v1.0 — Dynamic Payment Gateway Architecture
