#!/bin/bash
# NOVO STARTUP SCRIPT
# Brings the entire system online in the correct order

set -e

echo "🚀 NOVO System Startup"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 1. Nginx
echo "1️⃣  Starting Nginx..."
sudo systemctl start nginx
sleep 2
echo "   ✅ Nginx started"
echo ""

# 2. Portal Server
echo "2️⃣  Starting Portal Server..."
cd /root/clawd/avatar-portal
PORT=3001 node portal-server.js > /tmp/portal.log 2>&1 &
sleep 3
if lsof -i :3001 > /dev/null 2>&1; then
  echo "   ✅ Portal Server started on port 3001"
else
  echo "   ❌ Portal Server failed to start"
  cat /tmp/portal.log
  exit 1
fi
echo ""

# 3. Message Handler
echo "3️⃣  Starting Message Handler..."
cd /root/clawd
node portal-message-handler.js > /tmp/message-handler.log 2>&1 &
sleep 2
if pgrep -f "portal-message-handler.js" > /dev/null; then
  echo "   ✅ Message Handler started"
else
  echo "   ⚠️  Message Handler might need attention"
fi
echo ""

# 4. Final check
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✨ Running system check..."
echo ""
/root/clawd/system-status.sh
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ NOVO is ready! Access at: https://novopresent.com"
