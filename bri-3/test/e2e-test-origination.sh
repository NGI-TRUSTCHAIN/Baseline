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

log_message "Running E2E tests"
run_command "npm run test:e2e:origination"

log_message "Tests finished. You may shut down containers with: docker compose down -v"
