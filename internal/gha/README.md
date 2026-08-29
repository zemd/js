# @zemd/gha

The `gha` CLI executed by the shared GitHub Actions workflows.

Private: it is never published to npm. `pnpm --filter @zemd/gha run build`
bundles `src/cli.ts` into a single `dist/gha.mjs`. The separate
`pnpm --filter @zemd/gha run sync` command builds and synchronizes that output
to `.github/scripts/gha.mjs`, which **is** committed.

That indirection exists because `shared-release.yml` runs the CLI from a bare
checkout of this repository at the revision a consumer pinned — no package
manager, no `node_modules`, so it has to be one self-contained file. Committing
it also means a behaviour change shows up as a diff under `.github/scripts`,
which is what CI keys on to require a release intent for this package.

Its version is the shared workflow contract version: the release workflow tags
`vX.Y.Z` and moves `vX` to match.

For package releases, each `name@version` tag is the immutable submission
record. The publishing planner skips tagged versions even when a staged version
was rejected on npm; another release must advance the package version.

## Commands

```text
gha.mjs contract-version         prepare <package.json> <intents-dir> <state.json>
gha.mjs contract-version         finalize <state.json> <releases.json>
gha.mjs github-releases          <published-summary.json> <staged-summary.json> <release-manifest.json>
gha.mjs npm-publishing-mode      <workspace-list.json> <registry-url> <staged-publishing> <first-releases.txt> <direct-packages.txt> <staged-packages.txt>
gha.mjs package-artifact         <create|validate|tarball|summary> ...
gha.mjs release-pr-artifact      <workspace-list.json> <pr-body.md> <artifact-directory>
gha.mjs release-pr-body          <releases.json> <workspace-list.json>
gha.mjs release-plan             <create|validate> ...
gha.mjs shared-workflows-release <package.json> <workflows-dir> | pending <version>
gha.mjs signed-commit            <branch> <message> <base-oid> <artifact-directory>
```

Each lives in `src/commands/` as a thin argument-parsing adapter over a tested
module in `src/`. A test cross-checks that every command the workflows invoke is
registered.

## Working on it

```sh
pnpm --filter @zemd/gha run test
pnpm --filter @zemd/gha run build        # produce dist/gha.mjs only
pnpm --filter @zemd/gha run sync-check   # compare without writing
pnpm --filter @zemd/gha run sync         # regenerate .github/scripts, then commit it
```

Never edit `.github/scripts` by hand. CI builds the package, then runs the
read-only `sync-check` command and fails when the committed bundle differs.

`scripts/sync.ts` runs under Node's type stripping, so keep its syntax erasable.
