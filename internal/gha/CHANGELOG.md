# @zemd/gha

## 4.0.2

### Patch Changes

- Update the action versions used by the shared GitHub Actions workflows.

## 4.0.1

### Patch Changes

- Allow shared CI to succeed when tests produce no LCOV coverage files.

- Allow benchmark runs to succeed without publishing when the Bencher API key is missing.

## 4.0.0

### Major Changes

- Remove the `shared-tooling-repository` and `shared-tooling-ref` release inputs; shared release jobs now resolve tooling from the called workflow's own pinned revision.

### Patch Changes

- Allow shared release workflows to process private workspace packages without versions.

## 3.0.1

### Patch Changes

- Fix checkout-free release jobs to install pnpm from the pinned shared tooling manifest.

## 3.0.0

### Major Changes

- Isolate release metadata, package building, npm publishing, and GitHub writes across validated artifact boundaries; restore the optional npm-token fallback for first releases; and authenticate release-branch and GitHub Release operations with separate, repository-scoped GitHub Apps.

### Patch Changes

- Give the GitHub CLI an explicit repository when opening release pull requests.

## 2.1.1

### Patch Changes

- Isolate benchmark execution from authenticated Bencher publishing

## 2.1.0

### Minor Changes

- Add a reusable Bencher workflow for continuous benchmark history and pull-request comparisons.

## 2.0.4

### Patch Changes

- Separate GHA builds from committed bundle synchronization.

## 2.0.3

### Patch Changes

- Standardize reusable workflow caller example filenames.

## 2.0.2

### Patch Changes

- Update StepSecurity Harden Runner to v2.20.1.

## 2.0.1

### Patch Changes

- Harden GitHub Actions runners with StepSecurity.

## 2.0.0

### Major Changes

- Standardize shared workflow package scripts, Node.js LTS, npm registry, release pull request conventions, and mandatory dependency review.

### Patch Changes

- Add native Node.js coverage execution and LCOV artifact uploads to the shared CI workflow.

## 1.0.1

### Patch Changes

- Use token-free OIDC staging by default, automatically direct-publish only first releases with an optional npm token, preserve submitted versions as immutable releases even when npm approval is rejected, and advance the private shared-workflow contract version in release pull requests.

## 1.0.0

### Patch Changes

- Add zizmor integration

## 1.0.0

### Patch Changes

- Update the action versions used by the shared workflows.

## 1.0.0

### Major Changes

- Publish the CI, CodeQL, Scorecard and release pipelines as reusable `shared-*.yml` workflows that other monorepos call by pinned SHA, and move the release tooling into this typed, tested package whose bundle is committed to `.github/scripts`.
