#!/bin/bash
set -euo pipefail

cd /Users/myairbook/AIProjects/engineering-plastics-crm

# Kill old instances
lsof -ti :3001 2>/dev/null | xargs kill -9 2>/dev/null || true
lsof -ti :5173 2>/dev/null | xargs kill -9 2>/dev/null || true
sleep 1

echo ""
echo "  ╔═══════════════════════════════════════════╗"
echo "  ║   JEKIN CRM                               ║"
echo "  ║   Starting servers...                     ║"
echo "  ╚═══════════════════════════════════════════╝"
echo ""

# Start API
npm run dev:server &
sleep 3

# Start frontend
npm run dev:client &
sleep 2

# Check
API=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3001/api/health)
echo "  API: http://127.0.0.1:3001 ($([ "$API" = 200 ] && echo 'OK' || echo 'FAIL'))"
echo "  App: http://127.0.0.1:5173"

if [ "$API" = 200 ]; then
  if pgrep -fl "Google Chrome" 2>/dev/null | grep -q -- "--headless"; then
    # A headless Chrome instance is holding the default-browser handler (it opens
    # with no visible window); use Safari so the CRM actually shows up.
    open -a Safari http://127.0.0.1:5173 2>/dev/null || true
  else
    open http://127.0.0.1:5173 2>/dev/null || true
  fi
  echo "  ✅ CRM Ready"
fi

echo ""
echo "  Press Ctrl+C to stop"
wait
