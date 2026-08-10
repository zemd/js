#!/usr/bin/env bash

set -euo pipefail

expected_node="$(tr -d '[:space:]' < .node-version)"
actual_node="$(node --version)"
actual_node="${actual_node#v}"

if [[ "$actual_node" != "$expected_node" && "$actual_node" != "$expected_node".* ]]; then
  echo "Expected Node.js ${expected_node}.x from .node-version, found ${actual_node}." >&2
  exit 1
fi

expected_pnpm="$(node -p "require('./package.json').packageManager.split('@')[1].split('+')[0]")"
actual_pnpm="$(pnpm --version)"

if [[ "$actual_pnpm" != "$expected_pnpm" ]]; then
  echo "Expected pnpm ${expected_pnpm} from package.json, found ${actual_pnpm}." >&2
  exit 1
fi

sudo mkdir -p "$PWD/node_modules" "$PWD/.pnpm-store" "$HOME/.cache/ms-playwright"
sudo chown "$(id -u):$(id -g)" "$PWD/node_modules" "$PWD/.pnpm-store" "$HOME/.cache/ms-playwright"

pnpm install --frozen-lockfile --prefer-offline
pnpm test-browser-setup
