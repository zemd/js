# @zemd/gha

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
