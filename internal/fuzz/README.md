# @zemd/fuzz

[Jazzer.js](https://github.com/CodeIntelligenceTesting/jazzer.js) fuzz targets for the
packages in this workspace. They are executed on pull requests and on a schedule by
[ClusterFuzzLite](https://google.github.io/clusterfuzzlite/), configured in
[`../../.clusterfuzzlite`](../../.clusterfuzzlite).

This package is private and is never published.

## Targets

| Target                     | Code under test                                              | Invariants checked                                                  |
| -------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------- |
| `fuzz_std_objects_get`     | `get()` from `@zemd/std-modules/objects`                     | No unexpected throws, no prototype pollution                        |
| `fuzz_std_objects_merge`   | `merge()` from `@zemd/std-modules/objects`                   | No unexpected throws, no prototype pollution                        |
| `fuzz_std_math`            | `@zemd/std-modules/math`                                     | Range, sign and divisibility invariants                             |
| `fuzz_http_client_url`     | `prefix()` and `query()` from `@zemd/http-client`            | URL rewriting never changes the origin                              |
| `fuzz_http_client_headers` | `method()`, `header()` and `json()` from `@zemd/http-client` | No CR/LF/NUL in the emitted method or header map (header injection) |
| `fuzz_openapi_builders`    | `builder()`, `buildServerObject()`, `buildPathsObject()`     | No unexpected throws, no prototype pollution                        |

## Layout

- `src/fuzz_*.ts` — one exported `fuzz(data: Buffer)` function per file, as required by
  the Jazzer.js CLI.
- `src/helpers.ts` — shared input generators and invariant assertions.
- `dictionaries/*.dict` — libFuzzer dictionaries, applied automatically to the target
  with the matching name.

`tsdown` bundles each target into a self-contained CommonJS file in `dist/`. Bundling the
workspace packages keeps them outside `node_modules`, which is what makes Jazzer.js
instrument them for coverage feedback.

## Running a target locally

```shell
pnpm --filter "@zemd/fuzz..." run build
pnpm --filter @zemd/fuzz exec jazzer dist/fuzz_std_objects_merge.js --sync
```

Add a corpus directory to persist interesting inputs between runs:

```shell
pnpm --filter @zemd/fuzz exec jazzer dist/fuzz_std_objects_merge.js ./corpus --sync
```

Reproduce a single crashing input reported by ClusterFuzzLite:

```shell
pnpm --filter @zemd/fuzz exec jazzer dist/fuzz_std_objects_merge.js --sync -- ./crash-file
```

## Adding a target

1. Add `src/fuzz_<package>_<area>.ts` exporting a `fuzz` function.
2. Register it in [`../../.clusterfuzzlite/build.sh`](../../.clusterfuzzlite/build.sh); pass
   `--sync` only if the target is fully synchronous.
3. Optionally add `dictionaries/<target-name>.dict`.
