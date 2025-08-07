#!/bin/bash

set -e

log_message() {
  echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1"
}

run_command() {
  log_message "Running command: $1"
  eval $1
  if [ $? -ne 0 ]; then
    log_message "Error: Command failed: $1"
    exit 1
  fi
}

log_message "Bringing down previous Docker containers"
make down

log_message "Starting Docker containers"
make up

log_message "Waiting for services to be ready..."
sleep 30

MAX_WAIT=600
INTERVAL=30
WAITED=0

if [ ! -d "zeroKnowledgeArtifacts" ]; then
  log_message "'zeroKnowledgeArtifacts' folder not found, waiting up to 10 minutes for download to complete..."
  while [ $WAITED -lt $MAX_WAIT ]; do
    if [ -d "zeroKnowledgeArtifacts" ]; then
      log_message "'zeroKnowledgeArtifacts' folder found, continuing"
      break
    fi
    log_message "'zeroKnowledgeArtifacts' still not found after $WAITED seconds, waiting..."
    sleep $INTERVAL
    WAITED=$((WAITED + INTERVAL))
  done

  if [ ! -d "zeroKnowledgeArtifacts" ]; then
    log_message "Timeout reached (10 minutes) and 'zeroKnowledgeArtifacts' folder still not found. Exiting."
    exit 1
  fi
else
  log_message "'zeroKnowledgeArtifacts' folder found immediately, continuing"
fi

log_message "Running E2E tests"
run_command "npm run test:e2e:origination"

log_message "Tests finished. You may shut down containers with: docker compose down -v"
