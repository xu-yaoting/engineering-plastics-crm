#!/bin/bash
cd /Users/myairbook/AIProjects/engineering-plastics-crm

# Kill old instances
lsof -ti :3001 2>/dev/null | xargs kill -9 2>/dev/null
lsof -ti :5173 2>/dev/null | xargs kill -9 2>/dev/null
sleep 1

echo ""
echo "  ╔═══════════════════════════════════════════╗"
echo "  ║   Engineering Plastics CRM               ║"
echo "  ║   Starting servers...                     ║"
echo "  ╚═══════════════════════════════════════════╝"
echo ""

# Start API
npx tsx server/index.ts &
sleep 3

# Start frontend
npx vite --port 5173 --host &
sleep 2

# Check
API=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/health)
echo "  API: http://localhost:3001 ($([ $API == 200 ] && echo 'OK' || echo 'FAIL'))"
echo "  App: http://localhost:5173"

if [ $API == 200 ]; then
  open http://localhost:5173
  echo "  ✅ CRM Ready"
fi

echo ""
echo "  Press Ctrl+C to stop"
wait
