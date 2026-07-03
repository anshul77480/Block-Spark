#!/usr/bin/env bash
#
# One-command setup + run for the Insider Threat Detection & Response POC.
#
# It installs dependencies (idempotent), starts the local blockchain, deploys the
# AuditLog contract, seeds the database, trains the model, and starts the backend
# API and the Next.js dashboard — then streams logs. Press Ctrl+C to stop
# everything cleanly.
#
# Usage:
#   ./setup.sh                # install (if needed) + run everything
#   ./setup.sh --skip-install # skip dependency install, just run
#   ./setup.sh --install-only # install dependencies then exit
#   ./setup.sh --stop         # stop any services started by a previous run
#
set -euo pipefail

# ------------------------------------------------------------------ paths / config
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

LOG_DIR="$ROOT/logs"
PID_DIR="$ROOT/.pids"
mkdir -p "$LOG_DIR" "$PID_DIR"

BACKEND_PORT=8000
FRONTEND_PORT=3000
RPC_PORT=8545

# colours
C_GREEN='\033[0;32m'; C_BLUE='\033[0;34m'; C_YELLOW='\033[0;33m'; C_RED='\033[0;31m'; C_NC='\033[0m'
log()  { echo -e "${C_BLUE}[setup]${C_NC} $*"; }
ok()   { echo -e "${C_GREEN}[ ok ]${C_NC} $*"; }
warn() { echo -e "${C_YELLOW}[warn]${C_NC} $*"; }
die()  { echo -e "${C_RED}[fail]${C_NC} $*" >&2; exit 1; }

# ------------------------------------------------------------------ arg parsing
SKIP_INSTALL=0
INSTALL_ONLY=0
STOP_ONLY=0
for arg in "$@"; do
  case "$arg" in
    --skip-install) SKIP_INSTALL=1 ;;
    --install-only) INSTALL_ONLY=1 ;;
    --stop)         STOP_ONLY=1 ;;
    -h|--help)
      grep '^#' "$0" | sed 's/^# \{0,1\}//' | head -n 20
      exit 0 ;;
    *) die "unknown argument: $arg" ;;
  esac
done

# ------------------------------------------------------------------ stop helpers
kill_port() { # $1 = port
  if command -v fuser >/dev/null 2>&1; then
    fuser -k "$1/tcp" >/dev/null 2>&1 || true
  else
    # macOS / no fuser
    lsof -ti tcp:"$1" 2>/dev/null | xargs -r kill 2>/dev/null || true
  fi
}

stop_all() {
  log "stopping services ..."
  for name in frontend backend chain; do
    if [ -f "$PID_DIR/$name.pid" ]; then
      local pid; pid="$(cat "$PID_DIR/$name.pid")"
      kill "$pid" >/dev/null 2>&1 || true
      rm -f "$PID_DIR/$name.pid"
    fi
  done
  kill_port "$FRONTEND_PORT"; kill_port "$BACKEND_PORT"; kill_port "$RPC_PORT"
  ok "all services stopped"
}

if [ "$STOP_ONLY" = "1" ]; then
  stop_all
  exit 0
fi

# ------------------------------------------------------------------ prerequisites
command -v node >/dev/null 2>&1 || die "node is required (>=18). Install Node.js first."
command -v npm  >/dev/null 2>&1 || die "npm is required."
if command -v python3.11 >/dev/null 2>&1; then PY=python3.11
elif command -v python3 >/dev/null 2>&1;   then PY=python3
else die "python3 (3.11 recommended) is required."; fi
command -v curl >/dev/null 2>&1 || die "curl is required."
ok "prerequisites present (node $(node -v), $($PY --version 2>&1))"

# ------------------------------------------------------------------ install deps
install_backend() {
  log "backend: creating venv + installing pinned deps (first run downloads numpy/scipy/shap — be patient) ..."
  cd "$ROOT/backend"
  [ -d .venv ] || "$PY" -m venv .venv
  # shellcheck disable=SC1091
  source .venv/bin/activate
  pip install --upgrade pip -q
  pip install -q -r requirements.txt
  [ -f .env ] || cp .env.example .env
  deactivate
  ok "backend deps installed"
}

install_blockchain() {
  log "blockchain: installing Hardhat ..."
  cd "$ROOT/blockchain"
  [ -d node_modules ] || npm install --silent
  npx hardhat compile >/dev/null 2>&1
  ok "blockchain deps installed + contract compiled"
}

install_frontend() {
  log "frontend: installing Next.js deps ..."
  cd "$ROOT/frontend"
  [ -d node_modules ] || npm install --silent
  [ -f .env.local ] || cp .env.local.example .env.local
  ok "frontend deps installed"
}

if [ "$SKIP_INSTALL" = "0" ]; then
  install_backend
  install_blockchain
  install_frontend
else
  warn "skipping dependency install (--skip-install)"
fi

if [ "$INSTALL_ONLY" = "1" ]; then
  ok "install-only complete."
  exit 0
fi

# ------------------------------------------------------------------ start services
# make sure nothing is already bound
kill_port "$RPC_PORT"; kill_port "$BACKEND_PORT"; kill_port "$FRONTEND_PORT"
sleep 1

trap 'echo; stop_all; exit 0' INT TERM

wait_for() { # $1 = url, $2 = label, $3 = tries
  local tries="${3:-60}"
  for _ in $(seq 1 "$tries"); do
    if curl -s "$1" >/dev/null 2>&1; then return 0; fi
    sleep 1
  done
  return 1
}

wait_for_rpc() {
  for _ in $(seq 1 60); do
    if curl -s -X POST "http://127.0.0.1:$RPC_PORT" -H 'Content-Type: application/json' \
        -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  return 1
}

# --- 1) blockchain node ---
log "starting Hardhat node (:$RPC_PORT) -> logs/chain.log"
cd "$ROOT/blockchain"
npx hardhat node > "$LOG_DIR/chain.log" 2>&1 &
echo $! > "$PID_DIR/chain.pid"
wait_for_rpc || die "chain node did not come up (see logs/chain.log)"
ok "chain node is up"

# --- 2) deploy contract ---
log "deploying AuditLog contract ..."
npx hardhat run scripts/deploy.js --network localhost > "$LOG_DIR/deploy.log" 2>&1 \
  || die "contract deploy failed (see logs/deploy.log)"
ok "AuditLog deployed -> $(cat "$ROOT/blockchain/deployed_address.txt")"

# --- 3) seed + train ---
cd "$ROOT/backend"
# shellcheck disable=SC1091
source .venv/bin/activate
log "seeding database (admin + baseline activity) ..."
python -m app.seed > "$LOG_DIR/seed.log" 2>&1 || die "seed failed (see logs/seed.log)"
ok "database seeded"
log "training Isolation Forest ..."
python train_model.py > "$LOG_DIR/train.log" 2>&1 || die "training failed (see logs/train.log)"
ok "model trained -> $(tail -n1 "$LOG_DIR/train.log")"

# --- 4) backend API ---
log "starting backend API (:$BACKEND_PORT) -> logs/backend.log"
uvicorn app.main:app --host 127.0.0.1 --port "$BACKEND_PORT" > "$LOG_DIR/backend.log" 2>&1 &
echo $! > "$PID_DIR/backend.pid"
deactivate
wait_for "http://127.0.0.1:$BACKEND_PORT/health" "backend" 60 || die "backend did not come up (see logs/backend.log)"
ok "backend API is up ($(curl -s http://127.0.0.1:$BACKEND_PORT/health))"

# --- 5) frontend ---
log "starting frontend dashboard (:$FRONTEND_PORT) -> logs/frontend.log"
cd "$ROOT/frontend"
npm run dev > "$LOG_DIR/frontend.log" 2>&1 &
echo $! > "$PID_DIR/frontend.pid"
wait_for "http://127.0.0.1:$FRONTEND_PORT" "frontend" 90 || warn "frontend slow to start — check logs/frontend.log"
ok "frontend is up"

# ------------------------------------------------------------------ done
echo
echo -e "${C_GREEN}========================================================${C_NC}"
echo -e "${C_GREEN} Insider Threat SOC is running${C_NC}"
echo -e "   Dashboard : http://localhost:$FRONTEND_PORT   (login: admin / admin123)"
echo -e "   API docs  : http://localhost:$BACKEND_PORT/docs"
echo -e "   Chain RPC : http://localhost:$RPC_PORT"
echo
echo -e "   Logs      : $LOG_DIR/{chain,backend,frontend}.log"
echo -e "   Stop      : press Ctrl+C  (or ./setup.sh --stop)"
echo -e "${C_GREEN}========================================================${C_NC}"
echo
log "streaming backend + frontend logs (Ctrl+C to stop everything) ..."
tail -f "$LOG_DIR/backend.log" "$LOG_DIR/frontend.log" &
echo $! > "$PID_DIR/tail.pid"

# wait on the backend process; when it exits or Ctrl+C fires, clean up
wait "$(cat "$PID_DIR/backend.pid")"
