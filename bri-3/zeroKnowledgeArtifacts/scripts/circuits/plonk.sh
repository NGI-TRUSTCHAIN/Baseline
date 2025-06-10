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
  zeroKnowledgeArtifacts/ptau/pot15_final.ptau \
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

echo "------------------Phase 2 complete-------------------------"