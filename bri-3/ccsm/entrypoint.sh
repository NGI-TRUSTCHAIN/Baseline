#!/bin/bash

echo "[HARDHAT] Starting node..."
npx hardhat node &

NODE_PID=$!

# Wait for node to become available
sleep 5

echo "[HARDHAT] Deploying contracts..."
npx hardhat run scripts/deploy.ts --network localhost

# Keep container alive
wait $NODE_PID