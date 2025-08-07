#!/bin/bash

set -e

ARTIFACT_DIR="/app/zeroKnowledgeArtifacts"
ZIP_URL="https://zkartifacts.sfo3.digitaloceanspaces.com/zeroKnowledgeArtifacts.zip"

if [ ! -d "$ARTIFACT_DIR" ]; then
  echo "[ARTIFACTS] Downloading artifacts..."
  curl -L "$ZIP_URL" -o /tmp/artifacts.zip
  unzip -q /tmp/artifacts.zip -d /app/
  rm /tmp/artifacts.zip
  echo "[ARTIFACTS] Done extracting artifacts"
else
  echo "[ARTIFACTS] Already present. Skipping download."
fi

# Handover to CMD from Dockerfile or docker-compose
exec "$@"
