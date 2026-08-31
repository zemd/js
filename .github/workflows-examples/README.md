# Workflow examples

Ready-to-copy callers for this repository's reusable workflows.

| File                                             | Purpose                      |
| :----------------------------------------------- | :--------------------------- |
| [`repo-benchmarks.yml`](./repo-benchmarks.yml)   | Benchmarks with Bencher      |
| [`repo-ci.yml`](./repo-ci.yml)                   | CI                           |
| [`repo-pnpm-update.yml`](./repo-pnpm-update.yml) | Weekly pnpm update PRs       |
| [`repo-release.yml`](./repo-release.yml)         | npm and GitHub releases      |
| [`repo-codeql.yml`](./repo-codeql.yml)           | CodeQL analysis              |
| [`repo-scorecard.yml`](./repo-scorecard.yml)     | OpenSSF Scorecard            |
| [`repo-zizmor.yml`](./repo-zizmor.yml)           | GitHub Actions security lint |
| [`dependabot.yml`](./dependabot.yml)             | Dependency and SHA updates   |

## Setup

1. Copy the required `repo-*.yml` files to `.github/workflows/` and
   `dependabot.yml` to `.github/`.
2. Replace every `__SHA__` placeholder with the commit SHA for the v4 release
   you want to use.
3. Review the comments and optional `with:` inputs in each copied file.

`repo-pnpm-update.yml` also requires the `zemd-release-branchkeeper` GitHub App,
its Client ID in `RELEASE_BRANCHKEEPER_CLIENT_ID`, and its private key in
`RELEASE_BRANCHKEEPER_PRIVATE_KEY`. Keep that caller schedule-only.

Keep the release caller named `repo-release.yml` for npm trusted publishing.
Its `uses:` line is the only shared-tooling revision to maintain; the called
workflow resolves its own repository and commit from GitHub's job context.
