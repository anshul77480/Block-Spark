#!/usr/bin/env bash
# Chain container: start the Hardhat node, wait for it, deploy AuditLog, write the
# address to the shared volume, then keep the node running in the foreground.
set -e

echo "[chain] starting hardhat node ..."
npx hardhat node --hostname 0.0.0.0 > /tmp/hardhat.log 2>&1 &
NODE_PID=$!

echo "[chain] waiting for node ..."
for i in $(seq 1 60); do
  if curl -s -X POST http://127.0.0.1:8545 -H 'Content-Type: application/json' \
      -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' >/dev/null 2>&1; then
    echo "[chain] node up"
    break
  fi
  sleep 1
done

echo "[chain] deploying AuditLog ..."
ADDRESS_OUT="${ADDRESS_OUT:-/shared/deployed_address.txt}" \
  npx hardhat run scripts/deploy.js --network localhost

echo "[chain] deployed; address:"
cat "${ADDRESS_OUT:-/shared/deployed_address.txt}"
echo

# hand control to the node process
wait $NODE_PID
