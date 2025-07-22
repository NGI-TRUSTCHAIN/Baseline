#!/bin/sh
set -e

basename=$(basename "$1")
parent_dir=$(dirname "$1")

# if zeroKnowledgeArtifacts/circuits/$1 does not exist, make folder
[ -d zeroKnowledgeArtifacts/circuits/$1 ] || mkdir -p zeroKnowledgeArtifacts/circuits/$1

# --------------------------------------------------------------------------------
# Phase 2
# Circuit-specific setup

# Compile circuit
circom src/bri/zeroKnowledgeProof/services/circuit/snarkjs/$1.circom -o zeroKnowledgeArtifacts/circuits/$1 --r1cs --wasm

# Run setup using the basename for file names inside the nested folder
snarkjs plonk setup \
  zeroKnowledgeArtifacts/circuits/$1/$basename.r1cs \
  zeroKnowledgeArtifacts/ptau/pot16_final.ptau \
  zeroKnowledgeArtifacts/circuits/$1/${basename}_final.zkey

# Export verification key
snarkjs zkey export verificationkey \
  zeroKnowledgeArtifacts/circuits/$1/${basename}_final.zkey \
  zeroKnowledgeArtifacts/circuits/$1/${basename}_verification_key.json

# Make folder if it doesn't exist
mkdir -p ccsm/contracts/${parent_dir}

# Export Solidity verifier contract
snarkjs zkey export solidityverifier \
  zeroKnowledgeArtifacts/circuits/$1/${basename}_final.zkey \
  ccsm/contracts/${parent_dir}/${basename}Verifier.sol

# Compile Solidity verifier and move artifacts

# Move to ccsm folder to run Hardhat compile
cd ccsm

# Compile only the specific verifier contract (optional: just 'npx hardhat compile' will compile all)
npx hardhat compile

# Return to root
cd ..

# Copy generated artifacts to the zeroKnowledgeArtifacts folder
# Assuming hardhat config outputs to ccsm/artifacts
artifact_path="ccsm/artifacts/contracts/${parent_dir}/${basename}Verifier.sol"
destination="zeroKnowledgeArtifacts/circuits/$1"

if [ -d "$artifact_path" ]; then
  cp -r "$artifact_path" "$destination"
else
  echo "Warning: Artifact path not found: $artifact_path"
fi

echo "------------------Phase 2 complete-------------------------"