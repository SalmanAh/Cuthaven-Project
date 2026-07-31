# Testing Dynamic Payment Gateway Feature

## Test Scenarios

### Test 1: Both Stripe and PayPal Active ✓

**Setup:**
1. Ensure at least one Stripe gateway is active in database
2. Ensure at least one PayPal gateway is active in database

**Expected Result:**
- All three payment methods visible: Stripe Card, PayPal, COD
- Default selection: Stripe

**SQL to verify:**
```sql
SELECT gateway_type, account_name, is_active 
FROM payment_gateways 
WHERE is_active = true;
```

---

### Test 2: Only Stripe Active ✓

**Setup:**
1. Deactivate all PayPal gateways
2. Keep at least one Stripe gateway active

**Steps:**
```sql
UPDATE payment_gateways 
SET is_active = false 
WHERE gateway_type = 'paypal';
```

**Expected Result:**
- Only Stripe Card and COD visible
- PayPal button hidden
- Default selection: Stripe

---

### Test 3: Only PayPal Active ✓

**Setup:**
1. Deactivate all Stripe gateways
2. Keep at least one PayPal gateway active

**Steps:**
```sql
UPDATE payment_gateways 
SET is_active = false 
WHERE gateway_type = 'stripe';

UPDATE payment_gateways 
SET is_active = true 
WHERE gateway_type = 'paypal';
```

**Expected Result:**
- Only PayPal and COD visible
- Stripe Card button hidden
- Default selection: PayPal

---

### Test 4: Only COD Available ⚠️

**Setup:**
1. Deactivate all Stripe gateways
2. Deactivate all PayPal gateways

**Steps:**
```sql
UPDATE payment_gateways SET is_active = false;
```

**Expected Result:**
- Only COD button visible
- Warning message: "Online payment methods are currently unavailable. Only Cash on Delivery is available."
- Default selection: COD

---

### Test 5: API Error Handling

**Setup:**
1. Stop the backend server temporarily

**Expected Result:**
- Error toast: "Failed to load payment options. Please refresh the page."
- Graceful degradation to COD only

---

## Manual Testing Steps

### Full Test Flow:

1. **Start fresh:**
   ```bash
   cd /home/mbappe/Cuthaven-Project
   # Ensure backend is running
   cd backend && npm run dev
   # In another terminal, ensure frontend is running
   cd frontend && npm run dev
   ```

2. **Add product to cart:**
   - Visit http://localhost:3000/shop
   - Add any product to cart
   - Click "View Cart" or go to /cart

3. **Proceed to checkout:**
   - Click "Proceed to Checkout"
   - You should see loading state briefly: "Loading payment options..."

4. **Verify payment methods:**
   - Check which payment method buttons appear
   - Should match database active gateways

5. **Test deactivation:**
   - Open admin panel: http://localhost:3000/admin/payment-gateways
   - Deactivate Stripe
   - Refresh checkout page
   - Stripe option should disappear

6. **Test reactivation:**
   - Reactivate Stripe in admin panel
   - Refresh checkout page
   - Stripe option should reappear

---

## Expected Console Logs

When checkout page loads successfully:
```
(No errors in console)
```

When API call fails:
```
Failed to load payment gateways: [error message]
```

---

## Troubleshooting

### Problem: All payment methods showing even when deactivated
**Solution:** Clear browser cache and hard refresh (Ctrl+Shift+R)

### Problem: "Loading payment options..." never goes away
**Solution:** 
1. Check if backend is running
2. Check browser console for API errors
3. Verify `/api/checkout/active-gateways` endpoint is accessible

### Problem: Stripe/PayPal still showing after deactivation
**Solution:** 
1. Verify database update:
   ```sql
   SELECT * FROM payment_gateways WHERE is_active = true;
   ```
2. Hard refresh checkout page (Ctrl+Shift+R)

---

## Database Verification Queries

### Check active gateways:
```sql
SELECT 
  id,
  gateway_type,
  account_name,
  is_active,
  CASE 
    WHEN gateway_type = 'stripe' THEN LEFT(stripe_publishable_key, 12) || '...'
    WHEN gateway_type = 'paypal' THEN LEFT(paypal_client_id, 12) || '...'
  END as key_preview
FROM payment_gateways
ORDER BY gateway_type, is_active DESC;
```

### Activate specific gateway:
```sql
UPDATE payment_gateways 
SET is_active = true 
WHERE id = 'GATEWAY_ID_HERE';
```

### Deactivate specific gateway:
```sql
UPDATE payment_gateways 
SET is_active = false 
WHERE id = 'GATEWAY_ID_HERE';
```

---

## Success Criteria

- ✅ Payment methods dynamically load based on database
- ✅ Stripe only shows when active in database
- ✅ PayPal only shows when active in database
- ✅ COD always available as fallback
- ✅ No hardcoded environment variables used
- ✅ Changes take effect immediately after database update
- ✅ Loading state shown during API fetch
- ✅ Error handling for API failures
- ✅ Frontend build completes without errors
