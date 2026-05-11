#!/usr/bin/env bash
# ============================================================
# Eskoolia ERP — Test Runner
# Usage:
#   ./run_tests.sh           — run ALL tests (backend + frontend)
#   ./run_tests.sh smoke     — run only smoke tests (fast, pre-push)
#   ./run_tests.sh backend   — Django tests only
#   ./run_tests.sh frontend  — Jest tests only
# ============================================================

set -e  # stop on first failure

MODE="${1:-all}"
BACKEND_DIR="$(dirname "$0")/backend"
FRONTEND_DIR="$(dirname "$0")/frontend"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

run_backend() {
  echo -e "${YELLOW}▶ Running Django (pytest) tests...${NC}"
  cd "$BACKEND_DIR"
  if [ "$MODE" = "smoke" ]; then
    python -m pytest tests/ -m smoke -v --tb=short
  else
    python -m pytest tests/ -v --tb=short
  fi
  echo -e "${GREEN}✓ Backend tests passed${NC}"
  cd - > /dev/null
}

run_frontend() {
  echo -e "${YELLOW}▶ Running Jest (Next.js) tests...${NC}"
  cd "$FRONTEND_DIR"
  if [ "$MODE" = "smoke" ]; then
    npm test -- --testNamePattern="smoke" --passWithNoTests
  else
    npm test -- --passWithNoTests
  fi
  echo -e "${GREEN}✓ Frontend tests passed${NC}"
  cd - > /dev/null
}

case "$MODE" in
  backend)
    run_backend
    ;;
  frontend)
    run_frontend
    ;;
  smoke)
    run_backend
    run_frontend
    echo -e "${GREEN}✓ All smoke tests passed — safe to push!${NC}"
    ;;
  all|*)
    run_backend
    run_frontend
    echo -e "${GREEN}✓ All tests passed!${NC}"
    ;;
esac
