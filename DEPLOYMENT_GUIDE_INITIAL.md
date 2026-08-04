# CutHaven E-Commerce - Complete Initial Deployment Guide

**Date Created:** August 4, 2026  
**Domain:** cuthaven.com  
**VPS IP:** 72.61.4.10  
**Hosting:** Hostinger KVM 2 (8GB RAM, Ubuntu 24.04 LTS)

---

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [VPS Setup](#vps-setup)
3. [System Dependencies](#system-dependencies)
4. [Node.js Installation](#nodejs-installation)
5. [Code Deployment](#code-deployment)
6. [Environment Configuration](#environment-configuration)
7. [Backend Setup](#backend-setup)
8. [Frontend Setup](#frontend-setup)
9. [Nginx Configuration](#nginx-configuration)
10. [SSL Certificate Setup](#ssl-certificate-setup)
11. [PM2 Process Management](#pm2-process-management)
12. [DNS Configuration](#dns-configuration)
13. [Supabase Configuration](#supabase-configuration)
14. [Final Testing](#final-testing)
15. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Accounts & Services
- **GitHub Account** with repository: `github.com/SalmanAh/Cuthaven-Project`
- **Hostinger VPS** (KVM 2 or higher recommended)
- **Domain** registered and pointed to Hostinger nameservers
- **Supabase Project** URL: `https://gfvzppcuysscmvzgceff.supabase.co`
- **Stripe Account** (with test/production keys)
- **Resend Account** (for transactional emails)

### Local Machine Requirements
- SSH client installed
- Git installed
- Text editor (VS Code recommended)

---

## VPS Setup

### Step 1: Access VPS

```bash
# From your local machine
ssh root@72.61.4.10
```

**Initial Login:** Use password provided by Hostinger

### Step 2: Generate SSH Key (Local Machine)

```bash
# Generate SSH key pair
ssh-keygen -t ed25519 -f ~/.ssh/cuthaven -C "cuthaven-deployment"

# This creates two files:
# ~/.ssh/cuthaven (private key - keep secure!)
# ~/.ssh/cuthaven.pub (public key - copy to server)
```

### Step 3: Configure SSH Key Authentication

```bash
# Display public key (run on local machine)
cat ~/.ssh/cuthaven.pub

# Copy the output, then on VPS:
mkdir -p ~/.ssh
chmod 700 ~/.ssh
nano ~/.ssh/authorized_keys
# Paste the public key, save (Ctrl+O, Enter, Ctrl+X)

chmod 600 ~/.ssh/authorized_keys
```

### Step 4: Configure SSH Config (Local Machine)

```bash
nano ~/.ssh/config
```

Add this configuration:
```
Host cuthaven
    HostName 72.61.4.10
    User root
    IdentityFile ~/.ssh/cuthaven
    ServerAliveInterval 60
    ServerAliveCountMax 3
```

Save and test connection:
```bash
ssh cuthaven
```

---

## System Dependencies

### Step 1: Update System Packages

```bash
apt update && apt upgrade -y
```

**Expected Output:** System packages updated successfully


### Step 2: Install Essential Tools

```bash
apt install -y git curl wget build-essential
```

**What this installs:**
- **git**: Version control for code deployment
- **curl**: HTTP client for downloads
- **wget**: File downloader
- **build-essential**: C/C++ compilers for native Node modules

### Step 3: Install Nginx

```bash
apt install -y nginx
```

**Verify installation:**
```bash
nginx -v
# Expected: nginx version: nginx/1.24.0 (Ubuntu)

systemctl status nginx
# Expected: active (running)
```

### Step 4: Install Certbot (SSL Certificates)

```bash
apt install -y certbot python3-certbot-nginx
```

**Verify installation:**
```bash
certbot --version
# Expected: certbot 2.9.0
```

---

## Node.js Installation

### Important: Node.js 22+ Required
**Why:** Supabase requires Node.js 22+ for WebSocket support

### Step 1: Install Node.js 22

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs
```

### Step 2: Verify Installation

```bash
node --version
# Expected: v22.23.2 or higher

npm --version
# Expected: 10.8.2 or higher
```

### Step 3: Install PM2 (Process Manager)

```bash
npm install -g pm2
```

**Verify PM2:**
```bash
pm2 --version
# Expected: 7.0.3 or higher
```

---

## Code Deployment

### Step 1: Clone Repository

```bash
cd /root
git clone https://github.com/SalmanAh/Cuthaven-Project.git
cd Cuthaven-Project
```

### Step 2: Verify Code Structure

```bash
ls -la
```

**Expected directories:**
- `backend/` - Express.js API server
- `frontend/` - React/TanStack Start app
- `.gitignore` - Git ignore rules


---

## Environment Configuration

### Step 1: Transfer Backend .env File

**On Local Machine:**
```bash
cd /home/salman-ahmed/Documents/Cuthaven-Project
scp backend/.env cuthaven:/root/Cuthaven-Project/backend/.env
```

### Step 2: Update Backend .env for Production

```bash
cd /root/Cuthaven-Project/backend
nano .env
```

**Update these values:**
```env
NODE_ENV=production
FRONTEND_ORIGIN=https://cuthaven.com
PORT=4000

# Supabase (no changes needed)
SUPABASE_URL=https://gfvzppcuysscmvzgceff.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-actual-key-here

# Resend (no changes needed)
RESEND_API_KEY=your-actual-resend-key

# DO NOT include Stripe keys here - they're stored in database
```

**Save:** Ctrl+O, Enter, Ctrl+X

### Step 3: Transfer Frontend .env File

**On Local Machine:**
```bash
scp frontend/.env cuthaven:/root/Cuthaven-Project/frontend/.env
```

### Step 4: Update Frontend .env for Production

```bash
cd /root/Cuthaven-Project/frontend
nano .env
```

**Update these values:**
```env
VITE_API_URL=https://api.cuthaven.com/api
VITE_STORE_URL=https://cuthaven.com
```

**Save:** Ctrl+O, Enter, Ctrl+X

### Step 5: Secure Environment Files

```bash
chmod 600 /root/Cuthaven-Project/backend/.env
chmod 600 /root/Cuthaven-Project/frontend/.env
```

**Why:** Only root can read these files (contains sensitive keys)

---

## Backend Setup

### Step 1: Install Backend Dependencies

```bash
cd /root/Cuthaven-Project/backend
npm install
```

**Expected:** All dependencies installed without errors
**Time:** ~2-3 minutes


### Step 2: Build Backend

```bash
npm run build
```

**Expected Output:**
```
> tsc

Successfully built TypeScript project
```

**Verify build:**
```bash
ls -la dist/
# Expected: index.js and other compiled files
```

### Step 3: Start Backend with PM2

```bash
pm2 start dist/index.js --name cuthaven-backend
```

**Expected Output:**
```
[PM2] Starting /root/Cuthaven-Project/backend/dist/index.js in fork_mode (1 instance)
[PM2] Done.
┌────┬────────────────────┬──────────┬──────┬───────────┬──────────┬──────────┐
│ id │ name               │ mode     │ ↺    │ status    │ cpu      │ memory   │
├────┼────────────────────┼──────────┼──────┼───────────┼──────────┼──────────┤
│ 0  │ cuthaven-backend   │ fork     │ 0    │ online    │ 0%       │ 60.0mb   │
└────┴────────────────────┴──────────┴──────┴───────────┴──────────┴──────────┘
```

### Step 4: Verify Backend is Running

```bash
# Check PM2 status
pm2 list

# Check logs
pm2 logs cuthaven-backend --lines 20

# Test API endpoint
curl http://localhost:4000/api/products
```

**Expected:** JSON response with products or empty array

### Step 5: Save PM2 Configuration

```bash
pm2 save
```

**Expected:** Current process list saved to `/root/.pm2/dump.pm2`

---

## Frontend Setup

### Step 1: Install Frontend Dependencies

```bash
cd /root/Cuthaven-Project/frontend
npm install
```

**Expected:** All dependencies installed without errors
**Time:** ~3-5 minutes (larger than backend)

### Step 2: Build Frontend with Node Server Preset

**CRITICAL:** Must use `node-server` preset, NOT the default Cloudflare preset

```bash
NITRO_PRESET=node-server npm run build
```

**Expected Output:**
```
vite v8.1.4 building client environment for production...
✓ 2631 modules transformed.
.output/public/assets/styles-2iKtTtj3.css    111.23 kB │ gzip:  17.74 kB
...
✓ built in 3.95s

vite v8.1.4 building ssr environment for production...
✓ 137 modules transformed.
...
✓ built in 2.17s

[Nitro] Building (preset: node-server, compatibility: 2026-08-04)
✔ Generated public .output/public
...
✔ You can preview this build using npx vite preview
```


**Time:** ~5-7 minutes

### Step 3: Verify Build Output

```bash
ls -la .output/
# Expected directories: public/ and server/

ls -la .output/server/
# Expected: index.mjs (main server file)

ls -la .output/public/
# Expected: assets/ folder, favicon.ico, _headers
```

### Step 4: Start Frontend with PM2

```bash
pm2 start .output/server/index.mjs --name cuthaven-frontend
```

**Expected Output:**
```
[PM2] Starting /root/Cuthaven-Project/frontend/.output/server/index.mjs
[PM2] Done.
┌────┬────────────────────┬──────────┬──────┬───────────┬──────────┬──────────┐
│ id │ name               │ mode     │ ↺    │ status    │ cpu      │ memory   │
├────┼────────────────────┼──────────┼──────┼───────────┼──────────┼──────────┤
│ 0  │ cuthaven-backend   │ fork     │ 1    │ online    │ 0%       │ 93.7mb   │
│ 2  │ cuthaven-frontend  │ fork     │ 0    │ online    │ 0%       │ 22.0mb   │
└────┴────────────────────┴──────────┴──────┴───────────┴──────────┴──────────┘
```

### Step 5: Verify Frontend is Running

```bash
# Check PM2 logs
pm2 logs cuthaven-frontend --lines 20

# Expected in logs:
# ➜ Listening on: http://localhost:3000/ (all interfaces)

# Verify ports
ss -tlnp | grep node
```

**Expected Output:**
```
LISTEN 0  511  *:3000  *:*  users:(("node",pid=20134))  # Frontend
LISTEN 0  511  *:4000  *:*  users:(("node",pid=18737))  # Backend
```

### Step 6: Test Frontend Directly

```bash
curl -I http://localhost:3000
# Expected: HTTP/1.1 200 OK

curl -I http://localhost:3000/assets/styles-2iKtTtj3.css
# Expected: HTTP/1.1 200 OK with content-type: text/css
```

### Step 7: Save PM2 Configuration

```bash
pm2 save
```

---

## Nginx Configuration

### Step 1: Create Nginx Config File

```bash
nano /etc/nginx/sites-available/cuthaven
```

**Paste this configuration:**
```nginx
# Backend API (api.cuthaven.com)
server {
    listen 80;
    server_name api.cuthaven.com;

    location / {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}

# Frontend (cuthaven.com, www.cuthaven.com)
server {
    listen 80;
    server_name cuthaven.com www.cuthaven.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

**Save:** Ctrl+O, Enter, Ctrl+X


### Step 2: Enable Nginx Site

```bash
# Create symbolic link
ln -s /etc/nginx/sites-available/cuthaven /etc/nginx/sites-enabled/

# Remove default Nginx site
rm /etc/nginx/sites-enabled/default
```

### Step 3: Test Nginx Configuration

```bash
nginx -t
```

**Expected Output:**
```
nginx: the configuration file /etc/nginx/nginx.conf syntax is ok
nginx: configuration file /etc/nginx/nginx.conf test is successful
```

### Step 4: Reload Nginx

```bash
systemctl reload nginx
```

### Step 5: Verify Nginx is Running

```bash
systemctl status nginx
# Expected: active (running)

curl -I http://72.61.4.10
# Expected: HTTP/1.1 200 OK
```

---

## SSL Certificate Setup

### Step 1: Verify DNS is Propagated

**CRITICAL:** DNS must be fully propagated before requesting SSL certificates

```bash
dig +short cuthaven.com
dig +short www.cuthaven.com
dig +short api.cuthaven.com
```

**All three MUST return:** `72.61.4.10`

**If not all showing 72.61.4.10:** Wait and check again (DNS can take up to 48 hours)

### Step 2: Request SSL Certificates

```bash
certbot --nginx \
  -d cuthaven.com \
  -d www.cuthaven.com \
  -d api.cuthaven.com \
  --non-interactive \
  --agree-tos \
  --email khansalmanahmed9@gmail.com \
  --redirect
```

**Expected Output:**
```
Requesting a certificate for cuthaven.com and 2 more domains
Successfully received certificate.
Certificate is saved at: /etc/letsencrypt/live/cuthaven.com/fullchain.pem
Key is saved at: /etc/letsencrypt/live/cuthaven.com/privkey.pem
This certificate expires on 2026-11-02.
These files will be updated when the certificate renews.
Certbot has set up a scheduled task to automatically renew this certificate.

Successfully deployed certificate for cuthaven.com
Successfully deployed certificate for www.cuthaven.com
Successfully deployed certificate for api.cuthaven.com

Congratulations! You have successfully enabled HTTPS
```

### Step 3: Verify SSL Certificates

```bash
# Check certificate files exist
ls -la /etc/letsencrypt/live/cuthaven.com/

# Test HTTPS endpoints
curl -I https://cuthaven.com
curl -I https://www.cuthaven.com
curl -I https://api.cuthaven.com

# All should return: HTTP/1.1 200 OK or 301/302 redirect
```

### Step 4: Verify Auto-Renewal

```bash
certbot renew --dry-run
```

**Expected:** "Congratulations, all simulated renewals succeeded"

### Step 5: Check Nginx Config After Certbot

```bash
cat /etc/nginx/sites-enabled/cuthaven
```

**Certbot automatically adds:**
- `listen 443 ssl;` directives
- SSL certificate paths
- HTTP to HTTPS redirect rules


---

## PM2 Process Management

### Step 1: Configure PM2 Startup Script

This ensures PM2 restarts all processes after server reboot

```bash
pm2 startup systemd
```

**Expected Output:**
```
[PM2] Init System found: systemd
[PM2] To setup the Startup Script, copy/paste the following command:
sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u root --hp /root
```

**Copy and run the command it provides** (it will be specific to your system)

### Step 2: Save Current PM2 Processes

```bash
pm2 save
```

**Expected:** Current process list saved

### Step 3: Verify PM2 Processes

```bash
pm2 list
```

**Expected Output:**
```
┌────┬────────────────────┬──────────┬──────┬───────────┬──────────┬──────────┐
│ id │ name               │ mode     │ ↺    │ status    │ cpu      │ memory   │
├────┼────────────────────┼──────────┼──────┼───────────┼──────────┼──────────┤
│ 0  │ cuthaven-backend   │ fork     │ 1    │ online    │ 0%       │ 93.7mb   │
│ 2  │ cuthaven-frontend  │ fork     │ 0    │ online    │ 22.0mb   │
└────┴────────────────────┴──────────┴──────┴───────────┴──────────┴──────────┘
```

### Step 4: PM2 Commands Reference

```bash
# List all processes
pm2 list

# View logs (live)
pm2 logs

# View logs for specific app
pm2 logs cuthaven-backend
pm2 logs cuthaven-frontend

# View last 50 lines of logs
pm2 logs cuthaven-backend --lines 50

# Restart a process
pm2 restart cuthaven-backend
pm2 restart cuthaven-frontend

# Stop a process
pm2 stop cuthaven-backend

# Start a stopped process
pm2 start cuthaven-backend

# Delete a process (removes from PM2)
pm2 delete cuthaven-backend

# Monitor processes (CPU/Memory usage)
pm2 monit

# Describe process details
pm2 describe cuthaven-backend

# Save current process list
pm2 save

# Reload process list from saved state
pm2 resurrect
```

---

## DNS Configuration

### DNS Records Setup (Hostinger DNS Panel)

**Access:** Hostinger Control Panel → Domains → cuthaven.com → DNS Records

**Required Records:**

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | @ | 72.61.4.10 | 3600 |
| A | www | 72.61.4.10 | 3600 |
| A | api | 72.61.4.10 | 3600 |

### Important Notes:

1. **Delete any ALIAS records** pointing to `cuthaven.com.cdn.hstgr.net` or similar
2. **Only A records** should point to your VPS IP
3. **TTL** (Time To Live) of 3600 seconds = 1 hour
4. **Propagation time:** Up to 48 hours (usually 15 minutes to 2 hours)

### Verify DNS Propagation

```bash
# Check from VPS
dig +short cuthaven.com
dig +short www.cuthaven.com
dig +short api.cuthaven.com

# All should return: 72.61.4.10
```

**Alternative check from any computer:**
```bash
nslookup cuthaven.com
nslookup www.cuthaven.com
nslookup api.cuthaven.com
```

**Online tools:**
- https://www.whatsmydns.net
- https://dnschecker.org

---

## Supabase Configuration

### Step 1: Update Authentication URLs

1. Go to: https://supabase.com/dashboard/project/gfvzppcuysscmvzgceff/auth/url-configuration

2. Update **Site URL:**
   ```
   https://cuthaven.com
   ```

3. Add **Redirect URLs:**
   ```
   https://cuthaven.com/**
   ```
   (The `**` is a wildcard that allows all routes under your domain)

4. Click **Save**


### Step 2: Verify Database Connection

```bash
# From VPS, check backend logs
pm2 logs cuthaven-backend --lines 50

# Look for Supabase connection messages
# Should NOT see any WebSocket errors
```

### Step 3: Test Database Operations

```bash
# Test products API (reads from Supabase)
curl https://api.cuthaven.com/api/products

# Expected: JSON array of products or empty array []
```

### Step 4: Payment Gateway Configuration

Your payment gateways (Stripe keys) are stored in Supabase database:
- **Table:** `payment_gateways`
- **Active Gateway ID:** `84ff27de-dbb9-4548-bf06-ed9417f70c89`

**No .env configuration needed for payment keys!**

---

## Final Testing

### Step 1: Test Backend API

```bash
# Products endpoint
curl https://api.cuthaven.com/api/products

# Categories endpoint
curl https://api.cuthaven.com/api/categories

# Health check (if you have one)
curl https://api.cuthaven.com/api/health
```

**Expected:** JSON responses without errors

### Step 2: Test Frontend

**Open in browser:**
- https://cuthaven.com (main site)
- https://www.cuthaven.com (should redirect to https://cuthaven.com)

**Check:**
- ✅ Page loads with proper styling
- ✅ Images display correctly
- ✅ Navigation works
- ✅ No console errors (F12 → Console)

### Step 3: Test User Authentication

1. Go to https://cuthaven.com/account/register
2. Create a test account
3. Check email for verification (if enabled)
4. Try logging in

### Step 4: Test Product Browsing

1. Go to https://cuthaven.com/shop
2. Click on a product
3. Verify product details load
4. Add to cart
5. View cart

### Step 5: Test Checkout Flow

**⚠️ Use Stripe Test Mode:**
- Test card: `4242 4242 4242 4242`
- Expiry: Any future date
- CVC: Any 3 digits
- ZIP: Any 5 digits

1. Add item to cart
2. Proceed to checkout
3. Fill in shipping details
4. Enter test card
5. Complete payment

### Step 6: Test Admin Panel (if applicable)

1. Go to https://cuthaven.com/admin/dashboard
2. Login with admin credentials
3. Check analytics
4. Test product management
5. Test order management

### Step 7: Monitor Logs

```bash
# Watch both logs simultaneously
pm2 logs

# Or individually
pm2 logs cuthaven-backend
pm2 logs cuthaven-frontend
```

**Look for:** Any errors or warnings

### Step 8: Check SSL Certificate

**Browser check:**
1. Visit https://cuthaven.com
2. Click the padlock icon in address bar
3. Verify certificate is valid
4. Check expiry date (should be ~90 days from issue date)

**Command line check:**
```bash
echo | openssl s_client -connect cuthaven.com:443 2>/dev/null | openssl x509 -noout -dates
```

---

## Troubleshooting

### Problem: Backend not starting

**Check logs:**
```bash
pm2 logs cuthaven-backend --lines 100
```

**Common issues:**
1. **Missing .env file:** Verify `/root/Cuthaven-Project/backend/.env` exists
2. **Wrong Node version:** Run `node --version` (must be 22+)
3. **Port already in use:** Run `ss -tlnp | grep 4000`
4. **Supabase connection error:** Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY

**Solution:**
```bash
cd /root/Cuthaven-Project/backend
pm2 restart cuthaven-backend
pm2 logs cuthaven-backend
```


### Problem: Frontend not starting or showing errors

**Check logs:**
```bash
pm2 logs cuthaven-frontend --lines 100
```

**Common issues:**
1. **Built with wrong preset:** Must use `NITRO_PRESET=node-server`
2. **Missing .env file:** Verify `/root/Cuthaven-Project/frontend/.env` exists
3. **Port conflict:** Run `ss -tlnp | grep 3000`
4. **Build artifacts missing:** Check `.output/server/index.mjs` exists

**Solution - Rebuild:**
```bash
cd /root/Cuthaven-Project/frontend
pm2 delete cuthaven-frontend
NITRO_PRESET=node-server npm run build
pm2 start .output/server/index.mjs --name cuthaven-frontend
pm2 save
```

### Problem: CSS not loading (404 errors)

**Check:**
```bash
curl -I https://cuthaven.com/assets/styles-2iKtTtj3.css
```

**If returns 404:**
```bash
# Check if Node server serves it correctly
curl -I http://localhost:3000/assets/styles-2iKtTtj3.css

# If localhost works but https doesn't, check Nginx config
cat /etc/nginx/sites-enabled/cuthaven
```

**Solution:** Ensure Nginx proxies ALL requests to Node (no static file serving)

### Problem: SSL certificate request fails

**Error:** "Certificate Authority failed to verify..."

**Check DNS:**
```bash
dig +short cuthaven.com
dig +short www.cuthaven.com
dig +short api.cuthaven.com
```

**All must return:** 72.61.4.10

**If DNS is incorrect:**
1. Fix DNS records in Hostinger panel
2. Wait for propagation (15 min - 48 hours)
3. Verify again with `dig`
4. Retry Certbot

**Retry Certbot:**
```bash
certbot --nginx \
  -d cuthaven.com \
  -d www.cuthaven.com \
  -d api.cuthaven.com \
  --non-interactive \
  --agree-tos \
  --email khansalmanahmed9@gmail.com \
  --redirect
```

### Problem: Site shows "502 Bad Gateway"

**Meaning:** Nginx can't reach backend/frontend

**Check processes:**
```bash
pm2 list
```

**If status is "stopped" or "errored":**
```bash
pm2 restart cuthaven-backend
pm2 restart cuthaven-frontend
pm2 logs
```

**Check ports:**
```bash
ss -tlnp | grep node
```

**Expected:**
- Port 3000: Frontend
- Port 4000: Backend

### Problem: Site shows "500 Internal Server Error"

**Check application logs:**
```bash
pm2 logs cuthaven-frontend --lines 100
pm2 logs cuthaven-backend --lines 100
```

**Common causes:**
1. Frontend built with wrong Nitro preset
2. Missing environment variables
3. Database connection issues
4. Runtime errors in code

### Problem: PM2 processes don't restart after reboot

**Verify startup script:**
```bash
systemctl status pm2-root
```

**If not active:**
```bash
pm2 startup systemd
# Copy and run the command it provides
pm2 save
```

**Test reboot:**
```bash
reboot
# Wait 2-3 minutes, then reconnect
ssh cuthaven
pm2 list
```

### Problem: CORS errors in browser console

**Symptoms:**
```
Cross-Origin Request Blocked: The Same Origin Policy disallows reading the remote resource at https://api.cuthaven.com/api/products. (Reason: CORS header 'Access-Control-Allow-Origin' does not match 'https://cuthaven.com').
```

**Check backend .env:**
```bash
cat /root/Cuthaven-Project/backend/.env | grep FRONTEND_ORIGIN
```

**Must be exactly (no trailing slash):**
```
FRONTEND_ORIGIN=https://cuthaven.com
```

**Fix if wrong:**
```bash
nano /root/Cuthaven-Project/backend/.env
# Change to: FRONTEND_ORIGIN=https://cuthaven.com
pm2 restart cuthaven-backend --update-env
```

**Verify CORS headers:**
```bash
curl -I -H "Origin: https://cuthaven.com" https://api.cuthaven.com/api/products
# Should show: Access-Control-Allow-Origin: https://cuthaven.com
```

### Problem: Database connection errors

**Check Supabase credentials:**
```bash
cat /root/Cuthaven-Project/backend/.env | grep SUPABASE
```

**Verify Node version:**
```bash
node --version
# Must be 22+ for Supabase WebSocket support
```

**If you see "Node.js 20 detected" or WebSocket errors:**

**Solution - Reinstall node_modules with Node 22:**
```bash
cd /root/Cuthaven-Project/backend
rm -rf node_modules package-lock.json
npm install
npm run build
pm2 restart cuthaven-backend
pm2 logs cuthaven-backend --lines 20
```

**Test connection manually:**
```bash
cd /root/Cuthaven-Project/backend
node -e "console.log(process.env.SUPABASE_URL)"
```

### Problem: Express rate limiter validation errors

**Symptoms in logs:**
```
ValidationError: The 'X-Forwarded-For' header is set but the Express 'trust proxy' setting is false
```

**Cause:** Backend is behind Nginx proxy but not configured to trust proxy headers

**Solution:** Already fixed in codebase (app.set("trust proxy", 1))

**If you still see it after update:**
```bash
cd /root/Cuthaven-Project/backend
git pull origin main
npm run build
pm2 restart cuthaven-backend
```

### Problem: Payment not working

**Remember:** Payment keys are in DATABASE, not .env!

**Check database:**
```sql
-- Run in Supabase SQL Editor
SELECT * FROM payment_gateways WHERE gateway_type = 'stripe';
```

**Verify:**
- `stripe_publishable_key` exists
- `stripe_secret_key` exists
- `is_active = true`

### Getting Help

**Collect diagnostic info:**
```bash
# System info
uname -a
node --version
npm --version
pm2 --version
nginx -v

# Process status
pm2 list
pm2 describe cuthaven-backend
pm2 describe cuthaven-frontend

# Recent logs
pm2 logs --lines 100 --nostream > /tmp/pm2-logs.txt

# Nginx config
cat /etc/nginx/sites-enabled/cuthaven

# DNS status
dig +short cuthaven.com
dig +short api.cuthaven.com

# Port status
ss -tlnp | grep node
```

---

## Common Post-Deployment Issues

### Issue 1: CORS Errors (Frontend Can't Connect to Backend)

**Symptoms:**
- Browser console shows: "Cross-Origin Request Blocked"
- API calls fail with CORS errors
- Products/data not loading on frontend

**Root Cause:** Backend `FRONTEND_ORIGIN` doesn't match actual frontend domain

**Solution:**
```bash
# On VPS
ssh cuthaven
cat /root/Cuthaven-Project/backend/.env | grep FRONTEND_ORIGIN

# Must show: FRONTEND_ORIGIN=https://cuthaven.com
# If wrong, fix it:
nano /root/Cuthaven-Project/backend/.env
# Set: FRONTEND_ORIGIN=https://cuthaven.com (no trailing slash, no www)

# Restart with updated env
pm2 restart cuthaven-backend --update-env

# Verify fix
curl -I -H "Origin: https://cuthaven.com" https://api.cuthaven.com/api/products
# Should show: Access-Control-Allow-Origin: https://cuthaven.com
```

**Prevention:** Always use exact domain without trailing slash

---

### Issue 2: Supabase WebSocket Errors

**Symptoms:**
- Backend logs show: "Node.js detected but native WebSocket not found"
- Database queries fail
- Error mentions Node.js 20 when you have Node 22 installed

**Root Cause:** node_modules were installed with old Node version

**Solution:**
```bash
# On VPS
ssh cuthaven
cd /root/Cuthaven-Project/backend

# Verify Node version (must be 22+)
node --version

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# Rebuild and restart
npm run build
pm2 restart cuthaven-backend

# Verify - should see no WebSocket errors
pm2 logs cuthaven-backend --lines 30
```

**Prevention:** Always use Node 22+ from the start

---

### Issue 3: Express Trust Proxy Warnings

**Symptoms:**
- Logs show: "ValidationError: The 'X-Forwarded-For' header is set but Express 'trust proxy' setting is false"
- Rate limiting may not work correctly

**Root Cause:** Backend behind Nginx proxy but not configured to trust proxy headers

**Solution:**
```bash
# Pull latest code (fix added Aug 4, 2026)
cd /root/Cuthaven-Project/backend
git pull origin main
npm run build
pm2 restart cuthaven-backend

# Warnings should disappear
pm2 logs cuthaven-backend --lines 20
```

**Technical Details:** Code now includes `app.set("trust proxy", 1);` in index.ts

---

## Post-Deployment Checklist

- [ ] Backend running on PM2 (status: online)
- [ ] Frontend running on PM2 (status: online)
- [ ] PM2 startup script configured and saved
- [ ] Nginx configured and running
- [ ] SSL certificates installed and auto-renewal configured
- [ ] DNS records pointing to VPS IP (72.61.4.10)
- [ ] Supabase authentication URLs updated
- [ ] Payment gateway configured in database
- [ ] Site accessible at https://cuthaven.com
- [ ] API accessible at https://api.cuthaven.com
- [ ] No console errors in browser
- [ ] Authentication working (register/login)
- [ ] Products loading from database
- [ ] Shopping cart functional
- [ ] Checkout process tested with Stripe test card
- [ ] Email notifications working (Resend)
- [ ] Admin panel accessible (if applicable)

---

## Important Files & Paths

### VPS Locations
```
/root/Cuthaven-Project/                        # Main project directory
/root/Cuthaven-Project/backend/                # Backend code
/root/Cuthaven-Project/backend/.env            # Backend environment
/root/Cuthaven-Project/backend/dist/           # Compiled backend
/root/Cuthaven-Project/frontend/               # Frontend code
/root/Cuthaven-Project/frontend/.env           # Frontend environment
/root/Cuthaven-Project/frontend/.output/       # Built frontend
/etc/nginx/sites-available/cuthaven            # Nginx config
/etc/nginx/sites-enabled/cuthaven              # Active Nginx config (symlink)
/etc/letsencrypt/live/cuthaven.com/            # SSL certificates
/root/.pm2/                                    # PM2 configuration
/root/.pm2/logs/                               # PM2 logs
```

### Local Machine
```
~/.ssh/cuthaven                                # SSH private key
~/.ssh/cuthaven.pub                            # SSH public key
~/.ssh/config                                  # SSH configuration
/home/salman-ahmed/Documents/Cuthaven-Project/ # Local project
```

---

## Security Notes

1. **SSH Keys:** Keep `~/.ssh/cuthaven` private - never share or commit to Git
2. **Environment Files:** Never commit `.env` files to Git
3. **Supabase Keys:** Service role key has full database access - keep secure
4. **Stripe Keys:** Use test keys for testing, production keys only in production
5. **Server Access:** Only use SSH keys, never enable password authentication
6. **Firewall:** Consider enabling UFW firewall (allow ports 22, 80, 443)
7. **Updates:** Regularly update system packages with `apt update && apt upgrade`

---

## Maintenance Tasks

### Weekly
- Check PM2 logs for errors
- Monitor disk space: `df -h`
- Monitor memory usage: `free -h`

### Monthly
- Review SSL certificate expiry: `certbot certificates`
- Check for system updates: `apt update && apt list --upgradable`
- Review application logs for patterns

### Quarterly
- Update Node.js if new LTS version available
- Review and update npm dependencies
- Backup Supabase database
- Review security patches

---

**Deployment Date:** August 4, 2026  
**Deployed By:** Salman Ahmed  
**Status:** ✅ Production Ready

**Next Steps:** See `DEPLOYMENT_GUIDE_UPDATES.md` for redeployment guide
