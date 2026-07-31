# Dynamic Payment Gateway Feature

## Overview
The checkout page now dynamically loads and displays payment options based on which payment gateways are **active** in the database, rather than relying on hardcoded environment variables.

## What Changed

### Backend
The backend already had the necessary infrastructure:
- `/api/checkout/active-gateways` endpoint that returns only **active** payment gateways from the database
- Returns publishable keys for Stripe and client ID for PayPal (safe for frontend)
- Private keys remain secure on the backend

### Frontend API Client (`frontend/src/lib/api-client.ts`)
Added new function:
```typescript
export async function getActiveGatewaysForCheckout(): Promise<ActiveGatewaysForCheckout>
```

This fetches the active payment gateways configuration from the backend.

### Checkout Page (`frontend/src/routes/checkout.tsx`)

#### Key Changes:
1. **Removed hardcoded environment variables:**
   - ❌ `const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY)`
   - ❌ `const PAYPAL_CLIENT_ID = import.meta.env.VITE_PAYPAL_CLIENT_ID`

2. **Added dynamic gateway loading:**
   - Fetches active gateways from the API on component mount
   - Dynamically initializes Stripe only if active in database
   - Stores PayPal client ID only if active in database
   - Shows loading state while fetching gateway configuration

3. **Conditional rendering:**
   - Stripe card payment option only shows if `stripePromise` is loaded
   - PayPal option only shows if `paypalClientId` is available
   - Cash on Delivery is always available
   - Warning message appears if no online payment methods are active

4. **Smart default selection:**
   - Automatically selects first available payment method:
     - Stripe (if active) → PayPal (if active) → COD (fallback)

## How It Works

### Flow:
1. User visits `/checkout`
2. Component loads and calls `getActiveGatewaysForCheckout()`
3. Backend checks `payment_gateways` table for `is_active = true` records
4. Frontend receives configuration and initializes payment providers
5. Payment method buttons render based on what's available
6. User sees only the payment options that are currently active

### Database Control:
Admins can now control which payment methods appear on checkout by:
- Activating/deactivating gateways in the admin panel
- No code changes or environment variable updates needed
- Changes take effect immediately on next page load

## Benefits

1. **Admin Control:** Store admins can enable/disable payment methods without developer intervention
2. **Multi-Gateway Support:** Can have multiple Stripe/PayPal accounts and switch between them
3. **Security:** Keys stored in database, not in frontend environment files
4. **Flexibility:** Test/production keys can be swapped via admin panel
5. **User Experience:** Customers only see available, working payment options

## Migration Notes

### Old Behavior:
- Payment options controlled by `.env` files
- Stripe and PayPal appeared if environment variables existed
- Required deployment to change payment provider keys

### New Behavior:
- Payment options controlled by database records
- Stripe and PayPal appear if database record is active
- Keys managed through admin UI
- No deployment needed to change payment configurations

### Environment Variables (Optional):
The frontend `.env` files can still have `VITE_STRIPE_PUBLISHABLE_KEY` and `VITE_PAYPAL_CLIENT_ID` for backward compatibility, but they are **no longer used** by the checkout page. All configuration comes from the database.

## Testing

To test this feature:

1. **Verify database has payment gateways:**
   ```sql
   SELECT * FROM payment_gateways WHERE is_active = true;
   ```

2. **Test Stripe disabled:**
   - Deactivate all Stripe gateways in admin panel
   - Visit checkout — Stripe option should be hidden
   - Only PayPal and COD should appear

3. **Test PayPal disabled:**
   - Deactivate all PayPal gateways in admin panel
   - Visit checkout — PayPal option should be hidden
   - Only Stripe and COD should appear

4. **Test all disabled:**
   - Deactivate both Stripe and PayPal
   - Visit checkout — only COD should appear
   - Warning message should display

## Admin Panel Integration

Admins manage payment gateways at:
- Route: `/admin/payment-gateways`
- Can view, create, edit, activate, and delete gateway configurations
- Activating a gateway automatically makes it appear on checkout
- Deleting/deactivating removes it from checkout

## Future Enhancements

- Cache gateway configuration to reduce API calls
- Add gateway health checks
- Support for additional payment providers (Apple Pay, Google Pay, etc.)
- A/B testing between different gateway accounts
- Per-product or per-category gateway routing
