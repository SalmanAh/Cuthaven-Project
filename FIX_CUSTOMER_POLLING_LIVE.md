# 🔧 Fix Customer Polling on Live Server

## 🐛 Problem
Customer polling works **locally** but NOT on **live server**.

## ⚠️ Root Cause
Production frontend `.env` is using:
```bash
VITE_API_URL=http://localhost:4000/api  # ❌ Wrong for production!
```

This means customer chat widget tries to call `localhost` on the live server, which fails.

---

## ✅ Solution: Update Production .env

### **Step 1: SSH into VPS**
```bash
ssh cuthaven
# Or: ssh root@your-vps-ip
```

### **Step 2: Backup Current .env**
```bash
cd /root/Cuthaven-Project/frontend
cp .env .env.backup
```

### **Step 3: Update .env to Production Config**
```bash
cd /root/Cuthaven-Project/frontend
nano .env
```

**Replace content with:**
```env
# PRODUCTION ENVIRONMENT CONFIGURATION
VITE_API_URL=https://api.cuthaven.com/api
VITE_STORE_URL=https://www.cuthaven.com
VITE_SUPABASE_URL=https://gfvzppcuysscmvzgceff.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdmdnpwcGN1eXNzY212emdjZWZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMxMDI4NjAsImV4cCI6MjA5ODY3ODg2MH0.vPHj8dXmjXpfQKGGkCvj7UbKbKCTwqCSmw2LsFEz6Jg
```

**Save:** `Ctrl+O`, `Enter`, `Ctrl+X`

### **Step 4: Pull Latest Code**
```bash
cd /root/Cuthaven-Project
git pull origin main
```

### **Step 5: Rebuild Frontend**
```bash
cd /root/Cuthaven-Project/frontend
NITRO_PRESET=node-server npm run build
```

### **Step 6: Restart Frontend Service**
```bash
pm2 restart cuthaven-frontend
```

### **Step 7: Verify**
```bash
pm2 logs cuthaven-frontend --lines 20
```

---

## 🎯 Verification Checklist

1. **Check .env is correct:**
   ```bash
   cat /root/Cuthaven-Project/frontend/.env | grep VITE_API_URL
   # Should show: VITE_API_URL=https://api.cuthaven.com/api
   ```

2. **Test on live site:**
   - Open https://cuthaven.com
   - Click chat button
   - Send a message as customer
   - Send reply as admin
   - **Customer should see admin reply within 5 seconds** ✅

---

## 📝 Alternative: Use Pre-configured File

If you have `.env.production` in the repo:

```bash
cd /root/Cuthaven-Project/frontend
cp .env.production .env
NITRO_PRESET=node-server npm run build
pm2 restart cuthaven-frontend
```

---

## 🔍 Why This Happened

**Development .env:**
```env
VITE_API_URL=http://localhost:4000/api  # ← Works locally
```

**Production .env:**
```env
VITE_API_URL=https://api.cuthaven.com/api  # ← Works on live
```

The frontend is **built at compile time** with these env variables baked in. That's why:
- Local build works locally (uses localhost)
- But same build fails on live (localhost doesn't exist there)

**Solution:** Always rebuild with production env variables before deploying!

---

## ⚡ Quick Fix (One Command)

```bash
ssh cuthaven "cd /root/Cuthaven-Project/frontend && echo 'VITE_API_URL=https://api.cuthaven.com/api
VITE_STORE_URL=https://www.cuthaven.com
VITE_SUPABASE_URL=https://gfvzppcuysscmvzgceff.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdmdnpwcGN1eXNzY212emdjZWZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMxMDI4NjAsImV4cCI6MjA5ODY3ODg2MH0.vPHj8dXmjXpfQKGGkCvj7UbKbKCTwqCSmw2LsFEz6Jg' > .env && NITRO_PRESET=node-server npm run build && pm2 restart cuthaven-frontend"
```

---

## ✅ After Fix

**Customer polling will work on live:**
- ✅ Admin sends message → Customer sees it in 5 seconds
- ✅ Customer sends message → Admin sees it in 5 seconds
- ✅ No console errors
- ✅ Real-time communication working

---

## 📚 For Future Deployments

Always use **production env** when building for live:

```bash
# On VPS (production)
cd /root/Cuthaven-Project/frontend
cp .env.production .env  # Use production config
NITRO_PRESET=node-server npm run build
pm2 restart cuthaven-frontend

# On Local (development)
cd /home/salman-ahmed/Documents/Cuthaven-Project/frontend
cp .env.development .env  # Use development config
npm run dev
```
