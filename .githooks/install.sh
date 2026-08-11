#!/usr/bin/env bash
set -euo pipefail

if [[ ${CI:-} == "true" ]]; then
  echo "Skipping Git hook installation because CI=true."
  exit 0
fi

if ! repository_root="$(git rev-parse --show-toplevel 2>/dev/null)"; then
  echo "Skipping Git hook installation outside a Git checkout."
  exit 0
fi

current_hooks_path="$(git -C "$repository_root" config --local --get core.hooksPath || true)"
case "$current_hooks_path" in
  "" | .husky | .husky/_ | .githooks) ;;
  *)
    printf 'Refusing to replace the unrelated local core.hooksPath %q.\n' "$current_hooks_path" >&2
    exit 1
    ;;
esac

for hook_file in pre-commit pre-push; do
  hook_path="$repository_root/.githooks/$hook_file"
  if [[ -L "$hook_path" || ! -f "$hook_path" ]]; then
    echo "$hook_path must be a regular hook file." >&2
    exit 1
  fi
  chmod +x "$hook_path"
done

git -C "$repository_root" config --local core.hooksPath .githooks
echo "Installed native Git hooks from .githooks."
