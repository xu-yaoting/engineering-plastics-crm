#!/bin/bash
set -euo pipefail

cd /Users/myairbook/AIProjects/engineering-plastics-crm

get_lan_ip() {
  ipconfig getifaddr en0 2>/dev/null ||
  ipconfig getifaddr en1 2>/dev/null ||
  ifconfig | awk '/inet / && $2 != "127.0.0.1" { print $2; exit }'
}

LAN_IP="$(get_lan_ip || true)"

if [ -z "$LAN_IP" ]; then
  echo "Could not detect LAN IP. Check Wi-Fi or network connection."
  exit 1
fi

# Kill old local CRM instances
lsof -ti :3001 2>/dev/null | xargs kill -9 2>/dev/null || true
lsof -ti :5173 2>/dev/null | xargs kill -9 2>/dev/null || true
sleep 1

echo ""
echo "  ╔═══════════════════════════════════════════╗"
echo "  ║   Engineering Plastics CRM — LAN Mode     ║"
echo "  ║   Starting servers for internal testing   ║"
echo "  ╚═══════════════════════════════════════════╝"
echo ""

# Keep API bound to localhost. Vite proxies /api from LAN clients to the local API.
npm run dev:server &
sleep 3

# Expose the frontend to LAN users.
npm run dev:client:lan &
sleep 2

API=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3001/api/health)

echo "  API: http://127.0.0.1:3001 ($([ "$API" = 200 ] && echo 'OK' || echo 'FAIL'))"
echo "  本机访问: http://127.0.0.1:5173"
echo "  同事访问: http://$LAN_IP:5173"
echo ""

if [ "$API" = 200 ]; then
  open http://127.0.0.1:5173 2>/dev/null || true
  echo "  ✅ CRM LAN Ready"
fi

echo ""
echo "  Keep this window open while colleagues are using the CRM."
echo "  Press Ctrl+C to stop"
wait
