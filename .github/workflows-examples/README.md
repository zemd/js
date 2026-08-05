# Shared workflows

Copy-paste callers for the reusable workflows published from this repository.

| File                                 | Calls                  | Purpose                                                                    |
| :----------------------------------- | :--------------------- | :------------------------------------------------------------------------- |
| [`ci.yml`](./ci.yml)                 | `shared-ci.yml`        | Lint, format, typecheck, build, test matrix, Playwright, dependency review |
| [`release.yml`](./release.yml)       | `shared-release.yml`   | Release pull request, npm publish, git tags, GitHub release                |
| [`codeql.yml`](./codeql.yml)         | `shared-codeql.yml`    | CodeQL analysis                                                            |
| [`scorecard.yml`](./scorecard.yml)   | `shared-scorecard.yml` | OpenSSF Scorecard                                                          |
| [`dependabot.yml`](./dependabot.yml) | —                      | Keeps the pinned SHAs current                                              |

They assume a pnpm workspace with `lint-check`, `format-check`, `typecheck`,
`build`, `test` and `lint-publish` scripts in the root `package.json`. Any of
those can be renamed or disabled through workflow inputs — see the commented
`with:` block in each file.

## Install

1. Copy the four workflow files into `.github/workflows/` of the target
   repository and `dependabot.yml` into `.github/`.

2. Replace the `__SHA__` placeholder with the commit of the release you want:

   ```sh
   SHA="$(gh api repos/zemd/js/git/ref/tags/v1 --jq .object.sha)"
   sed -i.bak "s|@__SHA__|@${SHA}|g" .github/workflows/*.yml && rm .github/workflows/*.bak
   ```

   Every [`v*` release](https://github.com/zemd/js/releases) also lists the
   `uses:` lines already pinned, ready to copy.

3. Adjust the `with:` inputs if the repository's scripts differ from the
   defaults, and delete the workflows you do not need.

Dependabot rewrites both the SHA and the trailing `# v1` comment from then on,
so the pins stay current without dropping to a mutable ref.

## Release setup

`shared-release.yml` expects [`pnpm change`](https://pnpm.io) intents on `main`.
On every push it either opens/refreshes a `release/main` pull request, or — when
no intents are pending — publishes, tags and creates a combined GitHub release.

For npm **trusted publishing**:

- Keep the caller named `release.yml`. npm validates the calling workflow's
  filename, not the reusable workflow that runs the publish.
- Register the trusted publisher per package with the _consumer_ repository and
  `release.yml`.
- `id-token: write` must be granted by the caller job, which the example does.
- Keep `NPM_TOKEN` until every package exists on npm; a trusted publisher cannot
  be configured for a package that was never published.
- `repository.url` in each `package.json` must match the repository exactly.

## Repository settings

- **Settings → Actions → General → Actions permissions** must allow actions and
  reusable workflows from outside the repository.
- Both this repository and the consumer are public, so no extra access policy is
  needed. A public repository can only call reusable workflows that live in
  public repositories.
- GitHub does not follow redirects for reusable workflows: renaming `zemd/js`
  breaks every consumer.

## Notes

- `env` set at the caller's workflow level is **not** propagated into a reusable
  workflow. Pass an input instead.
- A called workflow's `github.workflow` is the _caller's_ name, so do not reuse
  the same `concurrency.group` on both sides with `cancel-in-progress: true`.
- Permissions can only be narrowed by the called workflow, never widened, which
  is why each example declares them on the calling job.
- `shared-release.yml` checks out its own revision into `.shared-ci/` to reach
  the bundled `gha.mjs` CLI, and adds that path to `.git/info/exclude` so it can
  never land in a release commit.
