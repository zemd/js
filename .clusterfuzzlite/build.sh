#!/bin/bash -eu

PNPM_VERSION=11.18.0
JAZZERJS_VERSION=4.0.0

# The repository is a pnpm workspace, so the packages under test and the fuzz targets are
# built with pnpm.
npm install -g "pnpm@${PNPM_VERSION}"

cd "$SRC/js"
pnpm install --frozen-lockfile

# Builds every workspace package the fuzz targets depend on, then bundles each target into
# a self-contained CommonJS file under internal/fuzz/dist.
pnpm --filter "@zemd/fuzz..." run build

# Jazzer.js loads the fuzz targets from a directory that it copies into $OUT together with
# its own node_modules. pnpm's symlinked store does not survive that copy, so the bundles
# are staged in a plain npm project whose only dependency is Jazzer.js itself.
FUZZ_PROJECT_NAME=zemd-js-fuzz
FUZZ_PROJECT_DIR="$SRC/$FUZZ_PROJECT_NAME"

rm -rf "$FUZZ_PROJECT_DIR"
mkdir -p "$FUZZ_PROJECT_DIR"
cp -r "$SRC/js/internal/fuzz/dist" "$FUZZ_PROJECT_DIR/dist"

cd "$FUZZ_PROJECT_DIR"
npm init -y > /dev/null
npm install --no-package-lock "@jazzer.js/core@${JAZZERJS_VERSION}"

# Fully synchronous targets.
compile_javascript_fuzzer "$FUZZ_PROJECT_NAME" dist/fuzz_std_objects_get.js --sync
compile_javascript_fuzzer "$FUZZ_PROJECT_NAME" dist/fuzz_std_objects_merge.js --sync
compile_javascript_fuzzer "$FUZZ_PROJECT_NAME" dist/fuzz_std_math.js --sync
compile_javascript_fuzzer "$FUZZ_PROJECT_NAME" dist/fuzz_openapi_builders.js --sync

# Promise based targets.
compile_javascript_fuzzer "$FUZZ_PROJECT_NAME" dist/fuzz_http_client_url.js
compile_javascript_fuzzer "$FUZZ_PROJECT_NAME" dist/fuzz_http_client_headers.js

# libFuzzer picks up <fuzz_target>.dict automatically.
cp "$SRC/js/internal/fuzz/dictionaries/"*.dict "$OUT/"
