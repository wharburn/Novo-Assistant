# NOVO SYSTEM CHECKLIST

This file defines the critical services, their state, and recovery procedures.

## Quick Status Check

Run this anytime to verify everything is up:

```bash
/root/clawd/system-status.sh
```

Expected output: **All green ✅**

---

## 🚀 STARTUP SEQUENCE

If the system is down or you're starting fresh:

### 1. **Redis** (Optional but recommended)
```bash
redis-server
# Or as service:
sudo systemctl start redis-server
```
Status: Can run independently, not required for portal

### 2. **Nginx** (Required for HTTPS)
```bash
sudo systemctl start nginx
# Verify:
sudo systemctl status nginx
```
Config: `/etc/nginx/sites-available/novopresent.com`

### 3. **Portal Server** (Required for frontend)
```bash
cd /root/clawd/avatar-portal
PORT=3001 node portal-server.js &
```
Runs on: `localhost:3001` → proxied to `https://novopresent.com`

### 4. **Clawdbot Main** (Already managed by systemd/pm2)
```bash
# Usually auto-starts, but if needed:
pnpm start
# Or check status:
clawdbot status
```

### 5. **Message Handler** (Portal integration)
```bash
cd /root/clawd
node portal-message-handler.js &
```

**Order matters:** Redis → Nginx → Portal → Clawdbot → Message Handler

---

## 📋 CRITICAL SERVICES

| Service | Port | Process | Config | Status Command |
|---------|------|---------|--------|-----------------|
| **Redis** | 6379 | redis-server | N/A | `systemctl status redis-server` |
| **Nginx** | 80/443 | nginx | `/etc/nginx/sites-available/novopresent.com` | `sudo systemctl status nginx` |
| **Portal Server** | 3001 | node portal-server.js | `/root/clawd/avatar-portal/portal-server.js` | `lsof -i :3001` |
| **Clawdbot Main** | (managed) | node dist/server.mjs | `/root/clawd` | `clawdbot status` |
| **Message Handler** | (background) | node portal-message-handler.js | `/root/clawd/portal-message-handler.js` | `pgrep -f portal-message-handler` |

---

## 🔍 ENDPOINTS TO CHECK

### Frontend
- **Portal**: https://novopresent.com/ (should show avatar UI)
- **Health**: http://localhost:3001/health (JSON: `{"status":"ok","port":"3001"}`)
- **API**: http://localhost:3001/api/uploads (JSON: list of uploads)

### WebSocket
- **Connection**: `wss://novopresent.com/socket.io` (real-time updates)

---

## 📁 CRITICAL FILES

```
/root/clawd/
├── avatar-portal/
│   ├── code/                      # Frontend (HTML/CSS/JS)
│   │   ├── index.html             # Main portal UI
│   │   ├── css/style.css          # Styling
│   │   └── js/                    # Avatar logic, WebSocket, etc.
│   ├── portal-server.js           # Express server + Socket.io
│   └── server/                    # Upload handler
├── portal-message-handler.js      # Clawdbot ↔ Portal bridge
├── hume-ai-integration.js         # Emotion detection API
├── portal-clawdbot-bridge.js      # Message routing
└── system-status.sh               # This checker script

/etc/nginx/
└── sites-available/
    └── novopresent.com            # Reverse proxy config

/etc/letsencrypt/
└── live/novofriend.com/
    ├── fullchain.pem              # SSL certificate
    └── privkey.pem                # SSL key
```

---

## ⚡ COMMON ISSUES & FIXES

### Problem: Portal shows "Connection refused" or blank page

**Check:**
```bash
# Is portal server running?
lsof -i :3001
ps aux | grep "portal-server.js"

# If not, start it:
cd /root/clawd/avatar-portal
PORT=3001 node portal-server.js &
```

**Check Nginx:**
```bash
sudo systemctl status nginx
sudo nginx -t  # Verify config
```

---

### Problem: HTTPS not working (SSL error)

**Check:**
```bash
# Verify certificate exists:
ls -la /etc/letsencrypt/live/novofriend.com/

# Verify Nginx has correct cert paths:
grep ssl_certificate /etc/nginx/sites-available/novopresent.com
```

**Fix:**
```bash
# Reload Nginx to pick up changes:
sudo systemctl reload nginx

# Or restart if needed:
sudo systemctl restart nginx
```

---

### Problem: WebSocket connection fails

**Check:**
```bash
# Verify Socket.io is proxied correctly:
curl -v https://novopresent.com/socket.io/

# Check browser console for errors (DevTools)
```

**Fix:**
```bash
# Restart portal server:
pkill -f "node.*portal-server.js"
cd /root/clawd/avatar-portal && PORT=3001 node portal-server.js &
```

---

### Problem: Emoji buttons don't respond

**Likely causes:**
- WebSocket not connected (check console)
- Avatar canvas not initialized (check JS errors)
- Portal server missing emotion handler

**Fix:**
```bash
# Restart everything in order:
sudo systemctl restart nginx
pkill -f "node.*portal-server.js"
sleep 2
cd /root/clawd/avatar-portal && PORT=3001 node portal-server.js &
```

---

## 🔄 RECOVERY PROCEDURES

### Full System Restart
```bash
# 1. Stop everything
pkill -f "portal-server.js"
pkill -f "portal-message-handler.js"
sudo systemctl stop nginx

# 2. Start in order
sudo systemctl start nginx
cd /root/clawd/avatar-portal && PORT=3001 node portal-server.js &
cd /root/clawd && node portal-message-handler.js &

# 3. Verify
/root/clawd/system-status.sh
```

### Quick Health Check After Changes
```bash
/root/clawd/system-status.sh
```

If all ✅ green → system is ready.

---

## 📊 MONITORING

Keep this running to catch issues early:

```bash
# Watch system status every 10 seconds:
watch -n 10 /root/clawd/system-status.sh

# Or run it manually when needed:
/root/clawd/system-status.sh
```

---

## 🎯 SUCCESS CRITERIA

The system is **working correctly** when:

- ✅ `/root/clawd/system-status.sh` shows all green (except Redis is optional)
- ✅ https://novopresent.com loads (shows avatar UI)
- ✅ http://localhost:3001/health returns 200
- ✅ Browser console has no JS errors
- ✅ Emotion buttons respond to clicks
- ✅ WebSocket is connected (check Network tab in DevTools)

---

## 📝 Changes Log

- **Jan 28, 2026**: Portal deployed on https://novopresent.com
- **Jan 28, 2026**: System status checker created
- **Jan 28, 2026**: Nginx configured for HTTPS + WebSocket
