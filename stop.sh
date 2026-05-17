#!/bin/bash
pkill -f "uvicorn app.main" 2>/dev/null && echo "백엔드 종료" || true
pkill -f "vite"             2>/dev/null && echo "프론트엔드 종료" || true
