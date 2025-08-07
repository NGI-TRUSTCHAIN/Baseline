#!/bin/bash

echo "[HARDHAT] Starting node..."
npx hardhat node &

NODE_PID=$!

# Wait for node to become available
sleep 30

echo "[HARDHAT] Deploying contracts..."
npx hardhat run --no-compile scripts/deploy.ts --network localhost

# Keep container alive
wait $NODE_PID