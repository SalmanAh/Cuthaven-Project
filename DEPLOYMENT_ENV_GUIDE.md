# 🚀 Environment Configuration Guide

## 📍 **Current Setup: Development**

Your `.env` files are currently configured for **LOCAL DEVELOPMENT**.

---

## 🔧 **Development Configuration (Current)**

### **Backend `.env`:**
```plaintext
PORT=4000
NODE_ENV=development
FRONTEND_ORIGIN=http://localhost:8080  # ← Local frontend
```

### **Frontend `.env`:**
```plaintext
VITE_API_URL=http://localhost:4000/api  # ← Local backend
VITE_STORE_URL=https://www.cuthaven.com
```

### **Running Locally:**
```bash
# Terminal 1 - Backend
cd /home/mbappe/Cuthaven-Project/backend
npm run dev  # Runs on http://localhost:4000

# Terminal 2 - Frontend  
cd /home/mbappe/Cuthaven-Project/frontend
npm run dev  # Runs on http://localhost:8080
```

---

## 🌐 **Production Configuration**

**BEFORE deploying to production**, update these values:

### **Backend `.env` (Production):**
```plaintext
PORT=4000  # Or your production port
NODE_ENV=production
FRONTEND_ORIGIN=https://www.cuthaven.com  # ← Production domain
```

### **Frontend `.env` (Production):**
```plaintext
VITE_API_URL=https://api.cuthaven.com/api  # ← Production backend URL
VITE_STORE_URL=https://www.cuthaven.com
```

---

## ⚠️ **IMPORTANT: CORS Explanation**

### **Why CORS Configuration Matters:**

The `FRONTEND_ORIGIN` in backend `.env` controls which domains can make API requests:

```
Development:
  Frontend: http://localhost:8080
  Backend CORS: http://localhost:8080  ✅ Allowed
  
Production:
  Frontend: https://www.cuthaven.com
  Backend CORS: https://www.cuthaven.com  ✅ Allowed
  
Production with Wrong CORS:
  Frontend: https://www.cuthaven.com
  Backend CORS: http://localhost:8080  ❌ BLOCKED!
```

### **Common Errors:**

#### **Error 1: "Couldn't reach the store backend"**
- **Cause:** CORS mismatch or backend not running
- **Solution:** Match `FRONTEND_ORIGIN` to where your frontend is hosted

#### **Error 2: CORS policy error in browser console**
```
Access to fetch at 'http://localhost:4000/api/products' 
from origin 'http://localhost:8080' has been blocked by CORS policy
```
- **Cause:** Backend `FRONTEND_ORIGIN` doesn't match frontend URL
- **Solution:** Update backend `.env` FRONTEND_ORIGIN

---

## 🔄 **Switching Between Environments**

### **Development → Production:**
1. Update `backend/.env`:
   ```diff
   -NODE_ENV=development
   -FRONTEND_ORIGIN=http://localhost:8080
   +NODE_ENV=production
   +FRONTEND_ORIGIN=https://www.cuthaven.com
   ```

2. Update `frontend/.env`:
   ```diff
   -VITE_API_URL=http://localhost:4000/api
   +VITE_API_URL=https://api.cuthaven.com/api
   ```

3. Restart backend server
4. Rebuild frontend: `npm run build`

### **Production → Development:**
1. Reverse the changes above
2. Restart backend server
3. Run frontend dev server: `npm run dev`

---

## 💡 **Pro Tip: Environment Files**

Create separate env files for each environment:

```
backend/
  .env              # ← Current environment (git ignored)
  .env.development  # ← Development config (commit this)
  .env.production   # ← Production config (commit this)
  
frontend/
  .env              # ← Current environment (git ignored)
  .env.development  # ← Development config (commit this)
  .env.production   # ← Production config (commit this)
```

Then copy the appropriate one:
```bash
# Switch to development
cp backend/.env.development backend/.env
cp frontend/.env.development frontend/.env

# Switch to production
cp backend/.env.production backend/.env
cp frontend/.env.production frontend/.env
```

---

## 📊 **Current Status**

✅ **Development Mode Active**
- Backend: `http://localhost:4000`
- Frontend: `http://localhost:8080`
- CORS: Configured for localhost
- Database: Production Supabase
- Payment Keys: From database

**When deploying:**
- [ ] Update `FRONTEND_ORIGIN` to production domain
- [ ] Update `VITE_API_URL` to production backend
- [ ] Register production webhook in Stripe
- [ ] Test live transaction

---

## 🎯 **Quick Reference**

| Setting | Development | Production |
|---------|-------------|------------|
| Backend PORT | 4000 | 4000 (or hosting port) |
| NODE_ENV | development | production |
| FRONTEND_ORIGIN | http://localhost:8080 | https://www.cuthaven.com |
| VITE_API_URL | http://localhost:4000/api | https://api.cuthaven.com/api |
| VITE_STORE_URL | https://www.cuthaven.com | https://www.cuthaven.com |

---

**Need help deploying? Check `PRODUCTION_READINESS.md` for full deployment checklist!**
