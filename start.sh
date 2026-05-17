#!/bin/bash
set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"

# 포트 정리
pkill -f "uvicorn app.main" 2>/dev/null || true
pkill -f "vite"             2>/dev/null || true
sleep 1

# 백엔드
echo "▶ 백엔드 기동 (http://localhost:8000)..."
cd "$ROOT/backend"
source .venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!
sleep 2

# 헬스체크
if curl -sf http://localhost:8000/health > /dev/null; then
  echo "  ✅ 백엔드 OK"
else
  echo "  ❌ 백엔드 실패"
fi

# 프론트엔드
echo "▶ 프론트엔드 기동 (http://localhost:5173)..."
cd "$ROOT/frontend"
npm run dev &
FRONTEND_PID=$!

echo ""
echo "════════════════════════════════"
echo "  대시보드: http://localhost:5173"
echo "  API Docs: http://localhost:8000/docs"
echo "  종료:     ./stop.sh"
echo "════════════════════════════════"

wait
