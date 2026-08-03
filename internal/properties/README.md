# @zemd/properties

Behavioural invariants of the published packages, written once and driven by two different
input generators:

- [`fast-check`](https://fast-check.dev) properties in the package test suites, which run on
  every `pnpm test` and shrink a failure to a minimal, readable counterexample.
- [`internal/fuzz`](../fuzz) targets, which run under coverage guided fuzzing and accumulate
  a corpus over time.

Keeping the assertions here is what stops the two from drifting apart. The generators stay
separate on purpose — that difference is the reason both are worth running.

This package is private, is never published and is consumed straight from TypeScript
source. It declares the surface under contract structurally instead of importing the
libraries, so the workspace dependency graph stays acyclic.

Because it is never published, the packages under test map it with a `paths` entry in
`tsconfig.json` and a matching `resolve.alias` in `vitest.config.ts` rather than declaring a
dependency that would appear in their published metadata as an unresolvable name.
`internal/fuzz` is private too, so it depends on this package normally and bundles it.

| Module                                | Invariants                                                                                                                                     |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| [`./math`](src/math.ts)               | `sign`, `clamp`, `clamp01`, `wrap`, `normalize`, `pingPong`, `nextPowerOfTwo`, `gcd` stay inside their documented ranges                       |
| [`./objects`](src/objects.ts)         | `get` reads own properties only, `merge` keeps its own prototype and shares no reference with its input, neither pollutes a built-in prototype |
| [`./http-client`](src/http-client.ts) | the URL transformers never change the origin, the header transformers never emit a control character                                           |
