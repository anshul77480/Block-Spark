#!/usr/bin/env bash
# Backend container startup: wait for the chain + deployed contract address,
# seed the DB, train the model, then start the API.
set -e

RPC_URL="${RPC_URL:-http://chain:8545}"
ADDR_FILE="${CONTRACT_ADDRESS_FILE:-/shared/deployed_address.txt}"

if [ "${SKIP_CHAIN_WAIT:-false}" = "true" ]; then
  echo "[backend] skipping chain availability check"
else
  echo "[backend] waiting for chain at ${RPC_URL} ..."
  for i in $(seq 1 60); do
    if curl -s -X POST "${RPC_URL}" -H 'Content-Type: application/json' \
        -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' >/dev/null 2>&1; then
      echo "[backend] chain is up"
      break
    fi
    sleep 2
  done
fi

if [ "${CHAIN_ENABLED:-true}" = "true" ]; then
  if [ -n "${CONTRACT_ADDRESS}" ]; then
    echo "[backend] contract address is set via environment variable: ${CONTRACT_ADDRESS}"
  else
    echo "[backend] waiting for contract address at ${ADDR_FILE} ..."
    for i in $(seq 1 60); do
      if [ -s "${ADDR_FILE}" ]; then
        echo "[backend] contract address: $(cat ${ADDR_FILE})"
        break
      fi
      sleep 2
    done
  fi
fi

echo "[backend] seeding database ..."
python -m app.seed

echo "[backend] training model ..."
python train_model.py

echo "[backend] starting API on 0.0.0.0:8000"
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
