# ⚡ QUICK REFERENCE

For when you just need to know the status and fix it fast.

## One Command to Check Everything

```bash
/root/clawd/system-status.sh
```

**Expected output:** All green ✅
**If red:** Scroll down to see which service is down, then use the fix below

---

## Services Status

```bash
# Check if Portal is running
lsof -i :3001

# Check if Nginx is running
sudo systemctl status nginx

# Check if Clawdbot is running
clawdbot status

# Check if message handler is running
pgrep -f "portal-message-handler"
```

---

## Start Everything (Fresh Boot)

```bash
/root/clawd/startup.sh
```

Or manually in order:
```bash
# 1. Nginx
sudo systemctl start nginx

# 2. Portal Server
cd /root/clawd/avatar-portal && PORT=3001 node portal-server.js &

# 3. Message Handler
cd /root/clawd && node portal-message-handler.js &
```

---

## Restart Something

```bash
# Kill Portal Server
pkill -f "node.*portal-server.js"

# Kill Message Handler
pkill -f "portal-message-handler"

# Restart Nginx
sudo systemctl restart nginx

# Check what's listening on port 3001
lsof -i :3001
```

---

## Test Endpoints

```bash
# Portal Frontend (should return HTML)
curl -s https://novopresent.com/ | head -20

# Portal Health Check (should return {"status":"ok"})
curl http://localhost:3001/health

# Portal API (should return uploads list)
curl http://localhost:3001/api/uploads

# WebSocket (should connect)
# Check browser DevTools → Network → WS
```

---

## Common Issues

### **Portal shows blank page / won't load**
```bash
# Restart everything
pkill -f "node.*portal-server.js"
sudo systemctl restart nginx
sleep 2
cd /root/clawd/avatar-portal && PORT=3001 node portal-server.js &
sleep 2
/root/clawd/system-status.sh
```

### **HTTPS error / SSL issue**
```bash
# Check cert exists
ls -la /etc/letsencrypt/live/novofriend.com/

# Reload Nginx
sudo systemctl reload nginx
```

### **WebSocket won't connect**
```bash
# Check browser console for errors
# Verify socket.io is proxied:
curl -v https://novopresent.com/socket.io/

# If 502, restart portal and nginx:
pkill -f "node.*portal-server.js"
sudo systemctl restart nginx
sleep 2
cd /root/clawd/avatar-portal && PORT=3001 node portal-server.js &
```

### **"Connection refused" on localhost:3001**
```bash
# Portal is not running
cd /root/clawd/avatar-portal && PORT=3001 node portal-server.js &
sleep 2
lsof -i :3001  # Should show node process
```

---

## Logs to Check

```bash
# Portal logs (if running in foreground)
tail /tmp/portal.log

# Nginx errors
sudo tail -20 /var/log/nginx/error.log

# Nginx access
sudo tail -20 /var/log/nginx/access.log

# System processes
ps aux | grep -E "portal|nginx|node"
```

---

## Key Directories

```bash
# Portal code
/root/clawd/avatar-portal/code/

# Portal server
/root/clawd/avatar-portal/portal-server.js

# Config files
/etc/nginx/sites-available/novopresent.com

# SSL certs
/etc/letsencrypt/live/novofriend.com/
```

---

## Success Indicators

✅ System is working when:
- `/root/clawd/system-status.sh` shows all green
- https://novopresent.com loads without errors
- Browser console (F12) has no red errors
- WebSocket shows "connected" in DevTools
- Emotion buttons respond to clicks
- Avatar renders on canvas

---

## Get Full Details

For complete info, see:
- `/root/clawd/SYSTEM.md` — Full operational manual
- `/root/clawd/system-status.sh` — The checker script itself
- `/root/clawd/startup.sh` — Startup automation

---

**Pro Tip:** Run `watch -n 10 /root/clawd/system-status.sh` to monitor continuously.
