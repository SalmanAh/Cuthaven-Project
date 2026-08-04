# CutHaven E-Commerce - Redeployment Guide for Updates

**Purpose:** Quick guide for deploying code updates to production  
**Prerequisites:** Initial deployment completed (see `DEPLOYMENT_GUIDE_INITIAL.md`)  
**Server:** 72.61.4.10 (Hostinger VPS)  
**Domain:** cuthaven.com

---

## Table of Contents
1. [Quick Update (Backend or Frontend Only)](#quick-update-backend-or-frontend-only)
2. [Full Update (Both Backend and Frontend)](#full-update-both-backend-and-frontend)
3. [Environment Variable Changes](#environment-variable-changes)
4. [Database Schema Changes](#database-schema-changes)
5. [Emergency Rollback](#emergency-rollback)
6. [Zero-Downtime Deployment](#zero-downtime-deployment)
7. [Troubleshooting Updates](#troubleshooting-updates)

---

## Pre-Deployment Checklist

Before deploying any update:

- [ ] Code tested locally and working
- [ ] All tests passing (if you have tests)
- [ ] Code committed and pushed to GitHub
- [ ] Database migrations tested (if applicable)
- [ ] Backup plan ready (know how to rollback)
- [ ] Maintenance window scheduled (if needed)

---

## Quick Update (Backend or Frontend Only)

### Backend Only Update

**When to use:** Only backend code changed (no frontend changes)

**Step 1: Connect to VPS**
```bash
ssh cuthaven
```

**Step 2: Navigate and Pull Changes**
```bash
cd /root/Cuthaven-Project/backend
git pull origin main
```

**Step 3: Install New Dependencies (if package.json changed)**
```bash
npm install
```

**Skip this step if only code changed, no new dependencies**

**Step 4: Rebuild Backend**
```bash
npm run build
```

**Expected:** TypeScript compilation successful

**Step 5: Restart Backend Process**
```bash
pm2 restart cuthaven-backend
```

**Step 6: Verify Deployment**
```bash
# Check process status
pm2 list

# Check logs for errors
pm2 logs cuthaven-backend --lines 50

# Test API endpoint
curl https://api.cuthaven.com/api/products
```

**Expected:** Status "online", no errors in logs, API responding

**Total Time:** ~2-3 minutes  
**Downtime:** ~5-10 seconds during restart

---

### Frontend Only Update

**When to use:** Only frontend code changed (no backend changes)

**Step 1: Connect to VPS**
```bash
ssh cuthaven
```

**Step 2: Navigate and Pull Changes**
```bash
cd /root/Cuthaven-Project/frontend
git pull origin main
```

**Step 3: Install New Dependencies (if package.json changed)**
```bash
npm install
```

**Skip this step if only code changed, no new dependencies**

**Step 4: Rebuild Frontend**
```bash
NITRO_PRESET=node-server npm run build
```

**⚠️ CRITICAL:** Always use `NITRO_PRESET=node-server` - never forget this!

**Expected:** Build completes successfully (~5-7 minutes)

**Step 5: Restart Frontend Process**
```bash
pm2 restart cuthaven-frontend
```

**Step 6: Verify Deployment**
```bash
# Check process status
pm2 list

# Check logs for errors
pm2 logs cuthaven-frontend --lines 50

# Test frontend
curl -I https://cuthaven.com

# Test CSS loading
curl -I https://cuthaven.com/assets/styles-2iKtTtj3.css
```

**Note:** CSS filename might change with each build (includes hash)

**Expected:** Status "online", no errors in logs, site responding with 200 OK

**Total Time:** ~7-10 minutes  
**Downtime:** ~5-10 seconds during restart

---

## Full Update (Both Backend and Frontend)

**When to use:** Changes in both backend and frontend

**Step 1: Connect to VPS**
```bash
ssh cuthaven
```

**Step 2: Pull All Changes**
```bash
cd /root/Cuthaven-Project
git pull origin main
```

**Step 3: Update Backend**
```bash
cd backend

# Install dependencies if package.json changed
npm install

# Build
npm run build

# Restart
pm2 restart cuthaven-backend
```

**Step 4: Update Frontend**
```bash
cd ../frontend

# Install dependencies if package.json changed
npm install

# Build with node-server preset
NITRO_PRESET=node-server npm run build

# Restart
pm2 restart cuthaven-frontend
```

**Step 5: Verify Both Services**
```bash
# Check all processes
pm2 list

# Monitor logs
pm2 logs

# Test backend API
curl https://api.cuthaven.com/api/products

# Test frontend
curl -I https://cuthaven.com
```

**Step 6: Browser Testing**
Open https://cuthaven.com and test:
- Homepage loads
- Navigation works
- Product pages load
- Cart functionality
- Checkout process
- Admin panel (if applicable)

**Total Time:** ~10-15 minutes  
**Downtime:** ~10-20 seconds total (services restart independently)

---

## Environment Variable Changes

### Backend Environment Changes

**Step 1: Update .env File**
```bash
cd /root/Cuthaven-Project/backend
nano .env
```

**Make your changes, then save:** Ctrl+O, Enter, Ctrl+X

**Step 2: Restart Backend with Updated Environment**
```bash
pm2 restart cuthaven-backend --update-env
```

**The `--update-env` flag ensures new variables are loaded**

**Step 3: Verify New Variables**
```bash
pm2 env 0  # 0 is the process ID, check with pm2 list
```

---

### Frontend Environment Changes

**Step 1: Update .env File**
```bash
cd /root/Cuthaven-Project/frontend
nano .env
```

**Make your changes, then save**

**Step 2: REBUILD Frontend**

**⚠️ IMPORTANT:** Frontend .env variables are compiled into build at build-time (not runtime)

```bash
NITRO_PRESET=node-server npm run build
```

**Step 3: Restart Frontend**
```bash
pm2 restart cuthaven-frontend
```

**Step 4: Verify Changes**
```bash
pm2 logs cuthaven-frontend --lines 20
```

---

## Database Schema Changes

### When You Need to Update Supabase Schema

**Step 1: Make Changes in Supabase Dashboard**
1. Go to: https://supabase.com/dashboard/project/gfvzppcuysscmvzgceff
2. Navigate to: Table Editor or SQL Editor
3. Make your schema changes (add tables, columns, etc.)
4. Test the changes

**Step 2: Update Backend Code (if needed)**
If your TypeScript types need updating:
```bash
cd /root/Cuthaven-Project/backend
nano src/types/your-type-file.ts
# Update type definitions
```

**Step 3: Deploy Backend Changes**
```bash
npm run build
pm2 restart cuthaven-backend
```

**Step 4: Test Database Operations**
```bash
# Test API endpoints that use new schema
curl https://api.cuthaven.com/api/your-endpoint
```

---

## Emergency Rollback

### If Update Causes Critical Issues

**Option 1: Rollback to Previous Git Commit**

**Step 1: Check Git History**
```bash
cd /root/Cuthaven-Project
git log --oneline -n 10
```

**Step 2: Identify Last Working Commit**
Look for the commit hash before your problematic changes

**Step 3: Rollback Code**
```bash
git checkout <commit-hash>
```

**Example:**
```bash
git checkout abc123f
```

**Step 4: Rebuild and Restart**

**For Backend:**
```bash
cd backend
npm run build
pm2 restart cuthaven-backend
```

**For Frontend:**
```bash
cd frontend
NITRO_PRESET=node-server npm run build
pm2 restart cuthaven-frontend
```

**Step 5: Return to Latest Code (when ready)**
```bash
git checkout main
```


---

**Option 2: Restore from PM2 Previous State**

PM2 keeps a dump of processes, but doesn't keep old code. This only helps if PM2 process crashed.

```bash
pm2 resurrect
```

---

**Option 3: Manual Fix**

If you know what's wrong:
```bash
# Edit the problematic file
nano /root/Cuthaven-Project/backend/src/file.ts

# Rebuild
cd /root/Cuthaven-Project/backend
npm run build

# Restart
pm2 restart cuthaven-backend
```

---

## Zero-Downtime Deployment

For critical production updates with no downtime:

### Strategy: Blue-Green Deployment

**Step 1: Start Second Instance on Different Port**

```bash
cd /root/Cuthaven-Project/backend

# Start new instance on port 4001
PORT=4001 pm2 start dist/index.js --name cuthaven-backend-new
```

**Step 2: Test New Instance**
```bash
curl http://localhost:4001/api/products
```

**Step 3: Update Nginx to Point to New Instance**
```bash
nano /etc/nginx/sites-enabled/cuthaven
```

Change backend proxy:
```nginx
# Change from:
proxy_pass http://localhost:4000;

# To:
proxy_pass http://localhost:4001;
```

**Step 4: Reload Nginx (No Downtime)**
```bash
nginx -t
systemctl reload nginx
```

**Step 5: Stop Old Instance**
```bash
pm2 stop cuthaven-backend
pm2 delete cuthaven-backend
```

**Step 6: Rename New Instance**
```bash
pm2 stop cuthaven-backend-new
# Update Nginx back to port 4000
nano /etc/nginx/sites-enabled/cuthaven
# Change back to: proxy_pass http://localhost:4000;
systemctl reload nginx

# Start on port 4000
pm2 delete cuthaven-backend-new
cd /root/Cuthaven-Project/backend
pm2 start dist/index.js --name cuthaven-backend
pm2 save
```

**Same strategy applies to frontend (use ports 3000 and 3001)**

---

## Common Update Scenarios

### Scenario 1: Adding New API Endpoint

**Files Changed:** Backend controllers/routes

**Steps:**
```bash
cd /root/Cuthaven-Project/backend
git pull origin main
npm run build
pm2 restart cuthaven-backend
```

**No frontend changes needed**

---

### Scenario 2: UI/Styling Changes Only

**Files Changed:** Frontend components/CSS

**Steps:**
```bash
cd /root/Cuthaven-Project/frontend
git pull origin main
NITRO_PRESET=node-server npm run build
pm2 restart cuthaven-frontend
```

**No backend changes needed**

---

### Scenario 3: New NPM Package Added

**Files Changed:** package.json, package-lock.json

**Steps:**
```bash
cd /root/Cuthaven-Project/[backend or frontend]
git pull origin main
npm install  # ← CRITICAL: Don't skip this
npm run build
pm2 restart cuthaven-[backend or frontend]
```

**Forgetting `npm install` will cause runtime errors!**

---

### Scenario 4: Environment Variable Added

**Backend:**
```bash
cd /root/Cuthaven-Project/backend
nano .env
# Add: NEW_VARIABLE=value
pm2 restart cuthaven-backend --update-env
```

**Frontend:**
```bash
cd /root/Cuthaven-Project/frontend
nano .env
# Add: VITE_NEW_VARIABLE=value
NITRO_PRESET=node-server npm run build  # ← Must rebuild!
pm2 restart cuthaven-frontend
```

---

### Scenario 5: Database Schema Change

**Steps:**
1. Update schema in Supabase dashboard
2. Update TypeScript types in backend
3. Deploy backend code
4. Update frontend if API responses changed
5. Deploy frontend code

**Order matters:** Always deploy backend before frontend when API changes

---

## Troubleshooting Updates

### Problem: "npm install" fails

**Check Node version:**
```bash
node --version
# Must be 22.23.2 or higher
```

**Clear npm cache:**
```bash
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

---

### Problem: Build fails with TypeScript errors

**Check error message:**
```bash
npm run build
```

**Common causes:**
1. Missing type definitions
2. Syntax errors introduced in update
3. Incompatible package versions

**Solution:** Fix errors in code or rollback

---

### Problem: PM2 restart doesn't apply changes

**Delete and recreate process:**
```bash
pm2 delete cuthaven-backend
cd /root/Cuthaven-Project/backend
pm2 start dist/index.js --name cuthaven-backend
pm2 save
```

---

### Problem: Frontend shows old cached version

**Clear browser cache:**
- Chrome: Ctrl+Shift+R (hard refresh)
- Firefox: Ctrl+F5
- Safari: Cmd+Shift+R

**Check if new files deployed:**
```bash
ls -la /root/Cuthaven-Project/frontend/.output/public/assets/
```

Look at file timestamps - should be recent

---

### Problem: Git pull shows conflicts

**If you edited files directly on VPS:**

```bash
# See what changed
git status

# Stash your changes
git stash

# Pull latest
git pull origin main

# Apply your changes back (may need manual merge)
git stash pop
```

**Best practice:** Never edit code directly on VPS. Always edit locally, commit, push, then pull on VPS.

---

### Problem: CORS errors after update

**Symptoms in browser:**
```
Cross-Origin Request Blocked: CORS header 'Access-Control-Allow-Origin' does not match
```

**Check backend environment:**
```bash
cat /root/Cuthaven-Project/backend/.env | grep FRONTEND_ORIGIN
```

**Must be exactly:**
```
FRONTEND_ORIGIN=https://cuthaven.com
```

**Fix:**
```bash
nano /root/Cuthaven-Project/backend/.env
# Update FRONTEND_ORIGIN=https://cuthaven.com (no trailing slash)
pm2 restart cuthaven-backend --update-env
```

**Verify:**
```bash
curl -I -H "Origin: https://cuthaven.com" https://api.cuthaven.com/api/products
# Should include: Access-Control-Allow-Origin: https://cuthaven.com
```

### Problem: Supabase WebSocket errors after update

**Symptoms in logs:**
```
Error: Node.js detected but native WebSocket not found.
Ensure you are running Node.js 22+ or provide a WebSocket implementation
```

**Cause:** node_modules installed with old Node version

**Solution:**
```bash
cd /root/Cuthaven-Project/backend
rm -rf node_modules package-lock.json
npm install
npm run build
pm2 restart cuthaven-backend
pm2 logs cuthaven-backend --lines 20
```

**Error should be gone**

### Problem: Express trust proxy validation warnings

**Symptoms in logs:**
```
ValidationError: The 'X-Forwarded-For' header is set but the Express 'trust proxy' setting is false
```

**This warning appears when backend is behind Nginx but not configured properly**

**Solution (already in codebase as of Aug 4, 2026):**
```bash
cd /root/Cuthaven-Project/backend
git pull origin main  # Get latest with trust proxy fix
npm run build
pm2 restart cuthaven-backend
```

**The fix adds:** `app.set("trust proxy", 1);` to index.ts

### Problem: Out of disk space

**Check disk usage:**
```bash
df -h
```

**Clear old logs:**
```bash
pm2 flush  # Clear PM2 logs
```

**Clear npm cache:**
```bash
npm cache clean --force
```

**Clear old builds (if any):**
```bash
cd /root/Cuthaven-Project/frontend
rm -rf node_modules/.vite
rm -rf node_modules/.cache
```

---

## Best Practices for Updates

### 1. Test Locally First
Always test changes on your local machine before deploying to production

### 2. Use Git Tags for Releases
```bash
# Tag a release locally
git tag -a v1.0.1 -m "Release version 1.0.1"
git push origin v1.0.1

# Deploy specific tag on VPS
cd /root/Cuthaven-Project
git fetch --tags
git checkout v1.0.1
```

### 3. Keep Deployment Log
Document each deployment:
```bash
nano /root/deployment-log.txt
```

Add entry:
```
2026-08-05 14:30 - Deployed v1.0.1
- Added new product filter feature
- Fixed cart calculation bug
- Updated Stripe webhook handler
```

### 4. Monitor After Deployment
```bash
# Watch logs for 5 minutes after deploy
pm2 logs

# Check for errors
pm2 logs | grep -i error

# Monitor process status
watch -n 2 pm2 list
```

### 5. Backup Before Major Updates
```bash
# Backup database (Supabase handles this, but you can export)
# Backup code (already in Git)
# Backup .env files
cp /root/Cuthaven-Project/backend/.env /root/backup-env-backend-$(date +%Y%m%d).env
cp /root/Cuthaven-Project/frontend/.env /root/backup-env-frontend-$(date +%Y%m%d).env
```

### 6. Schedule Updates During Low Traffic
- Check analytics for low-traffic periods
- Notify users if needed (maintenance banner)
- Have rollback plan ready

---

## Quick Reference Commands

### Update Backend Only
```bash
ssh cuthaven
cd /root/Cuthaven-Project/backend
git pull origin main
npm install  # if package.json changed
npm run build
pm2 restart cuthaven-backend
pm2 logs cuthaven-backend --lines 20
```

### Update Frontend Only
```bash
ssh cuthaven
cd /root/Cuthaven-Project/frontend
git pull origin main
npm install  # if package.json changed
NITRO_PRESET=node-server npm run build
pm2 restart cuthaven-frontend
pm2 logs cuthaven-frontend --lines 20
```

### Update Both
```bash
ssh cuthaven
cd /root/Cuthaven-Project
git pull origin main
cd backend && npm install && npm run build && pm2 restart cuthaven-backend && cd ..
cd frontend && npm install && NITRO_PRESET=node-server npm run build && pm2 restart cuthaven-frontend && cd ..
pm2 logs
```

### Check Status
```bash
pm2 list
pm2 logs --lines 50
curl https://api.cuthaven.com/api/products
curl -I https://cuthaven.com
```

### Emergency Rollback
```bash
cd /root/Cuthaven-Project
git log --oneline -n 5
git checkout <previous-commit-hash>
cd backend && npm run build && pm2 restart cuthaven-backend && cd ..
cd frontend && NITRO_PRESET=node-server npm run build && pm2 restart cuthaven-frontend
```

---

## Deployment Checklist

**Pre-Deployment:**
- [ ] Code tested locally
- [ ] Changes committed and pushed to GitHub
- [ ] Database migrations prepared (if any)
- [ ] Environment variables documented (if changed)
- [ ] Deployment window scheduled

**During Deployment:**
- [ ] Connected to VPS via SSH
- [ ] Pulled latest code (`git pull origin main`)
- [ ] Installed new dependencies (`npm install` if needed)
- [ ] Built backend (`npm run build`)
- [ ] Built frontend (`NITRO_PRESET=node-server npm run build`)
- [ ] Restarted PM2 processes
- [ ] Saved PM2 configuration (`pm2 save`)

**Post-Deployment:**
- [ ] Checked PM2 status (`pm2 list` - all online)
- [ ] Reviewed logs (`pm2 logs` - no errors)
- [ ] Tested backend API (curl or browser)
- [ ] Tested frontend (browser)
- [ ] Tested critical user flows (auth, checkout, etc.)
- [ ] Monitored for 15+ minutes
- [ ] Updated deployment log
- [ ] Notified team/stakeholders

---

## When Things Go Wrong

### Immediate Actions:
1. **Don't panic** - you have rollback options
2. **Check logs** - `pm2 logs`
3. **Identify issue** - specific error or general failure?
4. **Decide:** Quick fix or rollback?

### Quick Fix Path:
- Error in code? Fix and redeploy
- Missing env var? Add and restart with `--update-env`
- Wrong build? Rebuild with correct commands

### Rollback Path:
- Use `git checkout <previous-commit>`
- Rebuild both services
- Restart PM2 processes
- Verify functionality restored

### Nuclear Option:
If everything breaks and you can't fix quickly:
```bash
# Stop both services temporarily
pm2 stop all

# Show maintenance page (create if needed)
# Edit Nginx to serve static maintenance.html

# Fix issues offline
# Redeploy when ready
# Remove maintenance page
```

---

## Support & Resources

**Initial Deployment Guide:** `DEPLOYMENT_GUIDE_INITIAL.md`  
**This Guide (Updates):** `DEPLOYMENT_GUIDE_UPDATES.md`

**Key Documentation:**
- Supabase: https://supabase.com/docs
- PM2: https://pm2.keymetrics.io/docs/usage/quick-start/
- Nginx: https://nginx.org/en/docs/
- Let's Encrypt: https://letsencrypt.org/docs/

**VPS Details:**
- IP: 72.61.4.10
- SSH: `ssh cuthaven`
- OS: Ubuntu 24.04 LTS
- Node: 22.23.2

---

**Last Updated:** August 4, 2026  
**Maintained By:** Salman Ahmed  
**Version:** 1.0

**Remember:** When in doubt, test locally first, and always have a rollback plan! 🚀
