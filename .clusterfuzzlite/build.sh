#!/bin/bash -eu

# The repository is a pnpm workspace, so the packages under test and the fuzz targets are
# built with pnpm. Corepack installs the exact version from package.json's packageManager
# field and rejects the download if it does not match the integrity hash pinned there.
cd "$SRC/js"
corepack enable pnpm
corepack install

pnpm install --frozen-lockfile

# Builds every workspace package the fuzz targets depend on, then bundles each target into
# a self-contained CommonJS file under internal/fuzz/dist.
pnpm --filter "@zemd/fuzz..." run build

# Jazzer.js loads the fuzz targets from a directory that it copies into $OUT together with
# its own node_modules, so the bundles are staged in a throwaway project whose only
# dependency is Jazzer.js itself.
FUZZ_PROJECT_NAME=zemd-js-fuzz
FUZZ_PROJECT_DIR="$SRC/$FUZZ_PROJECT_NAME"

rm -rf "$FUZZ_PROJECT_DIR"
mkdir -p "$FUZZ_PROJECT_DIR"
cp -r "$SRC/js/internal/fuzz/dist" "$FUZZ_PROJECT_DIR/dist"

# Reuse the version @zemd/fuzz was built against so dependency updates land in one place.
JAZZERJS_VERSION=$(node -p "require('$SRC/js/internal/fuzz/package.json').devDependencies['@jazzer.js/core']")

cd "$FUZZ_PROJECT_DIR"
pnpm init > /dev/null
# Hoisted linking keeps node_modules free of pnpm's store symlinks, which do not survive
# the copy into $OUT.
pnpm add --node-linker=hoisted --no-lockfile "@jazzer.js/core@${JAZZERJS_VERSION}"

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
