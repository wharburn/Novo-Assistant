#!/bin/bash

# NOVO SYSTEM STATUS CHECKER
# Quick overview of all critical services

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔍 NOVO SYSTEM STATUS - $(date '+%Y-%m-%d %H:%M:%S UTC')"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

check_service() {
  local name=$1
  local port=$2
  local expected_process=$3
  
  echo -n "📍 $name (port $port)... "
  
  # Check if port is listening
  if lsof -i :$port >/dev/null 2>&1; then
    echo -e "${GREEN}✅ RUNNING${NC}"
    return 0
  else
    echo -e "${RED}❌ DOWN${NC}"
    return 1
  fi
}

check_file() {
  local name=$1
  local path=$2
  
  echo -n "📄 $path... "
  
  if [ -f "$path" ]; then
    echo -e "${GREEN}✅${NC}"
    return 0
  else
    echo -e "${RED}❌ MISSING${NC}"
    return 1
  fi
}

check_process() {
  local name=$1
  local pattern=$2
  
  echo -n "⚙️  $name... "
  
  if pgrep -f "$pattern" > /dev/null; then
    count=$(pgrep -f "$pattern" | wc -l)
    if [ $count -eq 1 ]; then
      echo -e "${GREEN}✅ (1 process)${NC}"
    else
      echo -e "${GREEN}✅ ($count processes)${NC}"
    fi
    return 0
  else
    echo -e "${RED}❌ NOT RUNNING${NC}"
    return 1
  fi
}

check_url() {
  local name=$1
  local url=$2
  
  echo -n "🌐 $name ($url)... "
  
  response=$(curl -sk --max-time 3 -w "\n%{http_code}" "$url" 2>/dev/null | tail -1)
  
  if [ "$response" = "200" ] || [ "$response" = "301" ]; then
    echo -e "${GREEN}✅ ($response)${NC}"
    return 0
  elif [ -z "$response" ]; then
    echo -e "${RED}❌ NO RESPONSE${NC}"
    return 1
  else
    echo -e "${YELLOW}⚠️  ($response)${NC}"
    return 1
  fi
}

# Track failures
failures=0

echo "━━━━━━━━━━━━━━━━━━━━━━━ CORE SERVICES ━━━━━━━━━━━━━━━━━━━━━━━"
check_service "Redis" 6379 "redis-server" || ((failures++))
check_service "Nginx" 80 "nginx" || ((failures++))
check_service "Portal Server" 3001 "node portal-server.js" || ((failures++))
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━ PROCESSES ━━━━━━━━━━━━━━━━━━━━━━━━"
check_process "Clawdbot Main" "node.*dist/server.mjs" || ((failures++))
check_process "Portal Server" "node.*portal-server.js" || ((failures++))
check_process "Message Handler" "node.*portal-message-handler.js" || ((failures++))
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━ ENDPOINTS ━━━━━━━━━━━━━━━━━━━━━━━━"
check_url "Portal Frontend" "https://novopresent.com/" || ((failures++))
check_url "Portal Health" "http://localhost:3001/health" || ((failures++))
check_url "Portal API" "http://localhost:3001/api/uploads" || ((failures++))
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━ CRITICAL FILES ━━━━━━━━━━━━━━━━━━━━━"
check_file "Portal Frontend" "/root/clawd/avatar-portal/code/index.html" || ((failures++))
check_file "Portal Server" "/root/clawd/avatar-portal/portal-server.js" || ((failures++))
check_file "Nginx Config" "/etc/nginx/sites-available/novopresent.com" || ((failures++))
check_file "SSL Cert" "/etc/letsencrypt/live/novofriend.com/fullchain.pem" || ((failures++))
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━ SUMMARY ━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ $failures -eq 0 ]; then
  echo -e "${GREEN}✅ ALL SYSTEMS OPERATIONAL${NC}"
  echo ""
  echo "System is ready for use. Portal accessible at:"
  echo "  → https://novopresent.com"
  exit 0
else
  echo -e "${RED}⚠️  $failures ISSUE(S) DETECTED${NC}"
  echo ""
  echo "Review the failures above and run:"
  echo "  → Portal: PORT=3001 node /root/clawd/avatar-portal/portal-server.js"
  echo "  → Nginx:  sudo systemctl restart nginx"
  echo "  → Redis:  redis-server (if needed)"
  exit 1
fi
