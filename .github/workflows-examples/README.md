# Shared workflows

Copy-paste callers for the reusable workflows published from this repository.

| File                                 | Calls                  | Purpose                                                                    |
| :----------------------------------- | :--------------------- | :------------------------------------------------------------------------- |
| [`ci.yml`](./ci.yml)                 | `shared-ci.yml`        | Lint, format, typecheck, build, test matrix, Playwright, dependency review |
| [`release.yml`](./release.yml)       | `shared-release.yml`   | Release pull request, npm submission, git tags, GitHub release             |
| [`codeql.yml`](./codeql.yml)         | `shared-codeql.yml`    | CodeQL analysis                                                            |
| [`scorecard.yml`](./scorecard.yml)   | `shared-scorecard.yml` | OpenSSF Scorecard                                                          |
| [`zizmor.yml`](./zizmor.yml)         | `shared-zizmor.yml`    | Blocking security lint for GitHub Actions and Dependabot                   |
| [`dependabot.yml`](./dependabot.yml) | —                      | Keeps the pinned SHAs current                                              |

They assume a pnpm workspace with `lint-check`, `format-check`, `typecheck`,
`build`, `test` and `lint-publish` scripts in the root `package.json`. Any of
those can be renamed or disabled through workflow inputs — see the commented
`with:` block in each file.

## Install

1. Copy the five workflow files into `.github/workflows/` of the target
   repository and `dependabot.yml` into `.github/`.

2. Replace the `__SHA__` placeholder with the commit of the release you want:

   ```sh
   SHA="$(gh api repos/zemd/js/git/ref/tags/v1 --jq .object.sha)"
   sed -i.bak "s|__SHA__|${SHA}|g" .github/workflows/*.yml && rm .github/workflows/*.bak
   ```

   Every [`v*` release](https://github.com/zemd/js/releases) also lists the
   `uses:` lines already pinned, ready to copy.

3. Adjust the `with:` inputs if the repository's scripts differ from the
   defaults, and delete the workflows you do not need.

Dependabot rewrites both the SHA and the trailing `# v1` comment from then on.
When it updates `release.yml`, keep `shared-tooling-ref` equal to the SHA in the
`uses:` line so the release scripts and reusable workflow stay on one revision.

`contract-version-package` is empty by default. Set it to a private package's
manifest only when that package versions a release contract but is never
published to npm. The release workflow advances it from its matching change
intents before pnpm prepares the release pull request.

## Release setup

`shared-release.yml` expects [`pnpm change`](https://pnpm.io) intents on `main`.
On every push it either opens/refreshes a `release/main` pull request, or — when
no intents are pending — stages packages on npm, tags them and creates a combined
GitHub release. A maintainer must then review and approve each staged package
with 2FA before it becomes available from npm.

[Staged publishing](https://docs.npmjs.com/staged-publishing/) is the default.
Set `staged-publishing: false` in the caller's `with:` block when packages must
publish immediately. npm cannot stage a package that does not exist yet, so use
direct publishing for its first release, then return to the staged default.

For npm [**trusted publishing**](https://docs.npmjs.com/trusted-publishers/):

- Keep the caller named `release.yml`. npm validates the calling workflow's
  filename, not the reusable workflow that runs the publish.
- Register the trusted publisher per package with the _consumer_ repository and
  `release.yml`.
- Allow `npm stage publish` for the default behavior. Consumers that disable
  staged publishing must allow `npm publish` instead (or allow both actions).
- `id-token: write` must be granted by the caller job, which the example does.
- Keep `NPM_TOKEN` until every package exists on npm. Set
  `staged-publishing: false` for that first publish because neither staged nor
  trusted publishing can bootstrap a new package.
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
- `shared-zizmor.yml` deliberately uses annotation output instead of SARIF so
  any finding fails the job. Its weekly caller also catches advisories published
  after an action was pinned; CodeQL remains the stateful code-scanning feed.
- `shared-release.yml` checks out the explicit `shared-tooling-repository` and
  `shared-tooling-ref` into `.shared-ci/` to reach the bundled `gha.mjs` CLI.
  Keep the ref equal to the SHA that pins the reusable workflow. The checkout is
  added to `.git/info/exclude` so it can never land in a release commit.
