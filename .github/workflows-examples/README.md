# Shared workflows

Copy-paste callers for the reusable workflows published from this repository.

| File                                           | Calls                   | Purpose                                                                    |
| :--------------------------------------------- | :---------------------- | :------------------------------------------------------------------------- |
| [`repo-benchmarks.yml`](./repo-benchmarks.yml) | `shared-benchmarks.yml` | Continuous benchmark history and pull-request comparisons with Bencher     |
| [`repo-ci.yml`](./repo-ci.yml)                 | `shared-ci.yml`         | Lint, format, typecheck, build, test matrix, Playwright, dependency review |
| [`repo-release.yml`](./repo-release.yml)       | `shared-release.yml`    | Release pull request, npm submission, git tags, GitHub release             |
| [`repo-codeql.yml`](./repo-codeql.yml)         | `shared-codeql.yml`     | CodeQL analysis                                                            |
| [`repo-scorecard.yml`](./repo-scorecard.yml)   | `shared-scorecard.yml`  | OpenSSF Scorecard                                                          |
| [`repo-zizmor.yml`](./repo-zizmor.yml)         | `shared-zizmor.yml`     | Blocking security lint for GitHub Actions and Dependabot                   |
| [`dependabot.yml`](./dependabot.yml)           | —                       | Keeps the pinned SHAs current                                              |

They assume a pnpm workspace with `lint-check`, `format-check`, `typecheck`,
`build`, `test`, `test-bench` and `lint-publish` scripts in the root
`package.json`. These standard script names, Node.js LTS, and the npm registry
are fixed provider conventions. The commented `with:` blocks expose only
workflow-specific policy choices.

## Install

1. Copy the six `repo-*.yml` workflow files into `.github/workflows/` of the
   target repository without renaming them, and copy `dependabot.yml` into
   `.github/`.

2. Replace the `__SHA__` placeholder with the commit of the release you want:

   ```sh
   SHA="$(gh api repos/zemd/js/git/ref/tags/v2 --jq .object.sha)"
   sed -i.bak "s|__SHA__|${SHA}|g" .github/workflows/*.yml && rm .github/workflows/*.bak
   ```

   Every [`v*` release](https://github.com/zemd/js/releases) also lists the
   `uses:` lines already pinned, ready to copy.

3. Adjust genuine policy inputs where needed, and delete the workflows you do
   not need.

Dependabot rewrites both the SHA and the trailing `# v3` comment from then on.
When it updates `repo-release.yml`, keep `shared-tooling-ref` equal to the SHA in
the `uses:` line so the release scripts and reusable workflow stay on one revision.

`contract-version-package` is empty by default. Set it to a private package's
manifest only when that package versions a release contract but is never
published to npm. The release workflow advances it from its matching change
intents before pnpm prepares the release pull request.

## Benchmark setup

`shared-benchmarks.yml` runs the fixed root `test-bench` script on Node.js LTS
and reports the results to an existing Bencher project. Benchmark execution and
authenticated publication use separate GitHub-hosted jobs: caller code receives
only `contents: read`, while an immutable artifact is validated and published
from a fresh runner that never checks out or executes caller code.

1. Create the Bencher project and a project-scoped API key.
2. Add the project slug or UUID as the `BENCHER_PROJECT` repository variable.
3. Add the project key as the `BENCHER_API_KEY` repository secret.
4. Make `pnpm test-bench` write one or more Bencher Metric Format `.json` files
   directly inside `BENCHER_OUTPUT_DIR` when that variable is present. The
   `toBencherMetricFormat` helper from `@zemd/testing` provides the conversion
   without owning file or network I/O.

The example remains dormant until `BENCHER_PROJECT` is set. It records `main`
history and compares same-repository pull requests with their base revision;
fork pull requests are skipped because GitHub does not expose repository secrets
to them. The project key and write-capable GitHub token are injected only into
the final Bencher command after the artifact has passed strict BMF validation.
Reports are informational by default. After the Bencher project has stable
thresholds, set `error-on-alert: true` to make alerts fail the job.

## Release setup

`shared-release.yml` expects [`pnpm change`](https://pnpm.io) intents on `main`.
On every push it either opens/refreshes a `release/main` pull request, or — when
no intents are pending — builds package tarballs in an uncredentialed job,
validates them again in a fresh OIDC job, stages packages on npm, tags them and
creates a combined GitHub release. A maintainer must then review and approve each
staged package with 2FA before it becomes available from npm. If any publishable
workspace package does not exist in the registry, the recurring workflow fails
closed before publishing anything; bootstrap that package separately.

Submission is the immutable release boundary. The workflow tags both directly
published and staged package versions immediately. Approval only controls npm
availability: rejecting a staged package does not roll back its release or let a
later run reuse that version. Record a new change intent so the next attempt uses
the next version.

[Staged publishing](https://docs.npmjs.com/staged-publishing/) is the default.
Set `staged-publishing: false` in the caller's `with:` block when packages must
always publish immediately. npm cannot configure trusted publishing for a package
that does not exist yet, so first releases are deliberately outside this workflow.

### GitHub App identities

The release workflow deliberately has no write-capable `GITHUB_TOKEN`. It uses
two repository-installed GitHub Apps instead:

- **Release Branchkeeper** needs only **Contents: Read and write** and **Pull
  requests: Read and write**. It updates `release/main` and manages the release
  pull request.
- **Release Publisher** needs only **Contents: Read and write**. It creates the
  immutable version tags and combined GitHub Release.

Disable webhooks and event subscriptions for both Apps, install them only on the
repositories they release, and do not grant Actions, Administration, Workflows,
organization, or account permissions. Then configure these Actions credentials
in every consumer repository (organization-level values may be shared only with
the selected repositories):

| Kind     | Name                               | Value                                   |
| :------- | :--------------------------------- | :-------------------------------------- |
| Variable | `RELEASE_BRANCHKEEPER_CLIENT_ID`   | Release Branchkeeper Client ID          |
| Secret   | `RELEASE_BRANCHKEEPER_PRIVATE_KEY` | Release Branchkeeper's complete PEM key |
| Variable | `RELEASE_PUBLISHER_CLIENT_ID`      | Release Publisher Client ID             |
| Secret   | `RELEASE_PUBLISHER_PRIVATE_KEY`    | Release Publisher's complete PEM key    |

The reusable workflow mints a short-lived token only in the job for that role,
limits it to the current repository and the listed permissions, and lets the
token action revoke it at job completion.

Enforce the roles with repository rulesets:

- Protect `main` normally and give neither App a bypass.
- Restrict creation, updates, and deletion of `release/main`; make only Release
  Branchkeeper a bypass actor.
- Restrict creation, updates, and deletion for every release-tag pattern; make
  only Release Publisher a bypass actor.
- Enable immutable releases and monitor release audit events for any actor other
  than Release Publisher.

GitHub exposes release-object creation through the coarse **Contents: write**
permission rather than a separate Release permission. The distinct keys and jobs
enforce that separation in the workflow; the rulesets independently enforce the
branch and tag boundaries.

For npm [**trusted publishing**](https://docs.npmjs.com/trusted-publishers/):

- Keep the caller named `repo-release.yml`. npm validates the calling workflow's
  filename, not the reusable workflow that runs the publish.
- Register the trusted publisher per package with the _consumer_ repository and
  `repo-release.yml`, and set its environment to `npm-production`.
- Create and protect the `npm-production` GitHub environment; require maintainer
  review and allow deployments only from protected branches.
- Configure each existing package's trusted publisher to allow only
  `npm stage publish` for the default behavior. Consumers that disable staged
  publishing must allow `npm publish` instead (or allow both actions).
- `id-token: write` must be granted by the caller job, which the example does.
- Bootstrap a first release through a separate, manually reviewed procedure with
  a short-lived granular token. Configure its trusted publisher immediately
  afterward. The recurring workflow does not accept an npm token.
- After OIDC publishing is verified, configure npm publishing access to require
  2FA and disallow traditional tokens, then revoke obsolete automation tokens.
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
- Permissions can only be narrowed by the called workflow, never widened. The
  caller grants only read access plus npm OIDC; GitHub App installation tokens
  carry the narrowly scoped GitHub write permissions independently.
- `shared-zizmor.yml` deliberately uses annotation output instead of SARIF so
  any finding fails the job. Its weekly caller also catches advisories published
  after an action was pinned; CodeQL remains the stateful code-scanning feed.
- `shared-release.yml` checks out the explicit `shared-tooling-repository` and
  `shared-tooling-ref` into `.shared-ci/` to reach the bundled `gha.mjs` CLI.
  Keep the ref equal to the SHA that pins the reusable workflow. The checkout is
  added to `.git/info/exclude` so it can never land in a release commit.
