#!/bin/bash

echo "[HARDHAT] Starting node..."
npx hardhat node &

NODE_PID=$!

echo "[HARDHAT] Waiting for node to be ready on port 8545..."

# Wait until hardhat RPC is available (max 30s)
for i in {1..30}; do
  if curl -s http://localhost:8545 > /dev/null; then
    echo "[HARDHAT] Node is up!"
    break
  else
    sleep 1
  fi
done

if ! curl -s http://localhost:8545 > /dev/null; then
  echo "[HARDHAT] ERROR: Node did not start within 30 seconds."
  kill $NODE_PID
  exit 1
fi

echo "[HARDHAT] Deploying contracts..."
npx hardhat run scripts/deploy.ts --network localhost

# Keep container alive
wait $NODE_PID