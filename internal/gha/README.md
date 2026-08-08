# @zemd/gha

The `gha` CLI executed by the shared GitHub Actions workflows.

Private: it is never published to npm. Instead `pnpm --filter @zemd/gha run build`
bundles `src/cli.ts` into a single `dist/gha.mjs` and syncs it to
`.github/scripts/gha.mjs`, which **is** committed.

That indirection exists because `shared-release.yml` runs the CLI from a bare
checkout of this repository at the revision a consumer pinned — no package
manager, no `node_modules`, so it has to be one self-contained file. Committing
it also means a behaviour change shows up as a diff under `.github/scripts`,
which is what CI keys on to require a release intent for this package.

Its version is the shared workflow contract version: the release workflow tags
`vX.Y.Z` and moves `vX` to match.

## Commands

```
gha.mjs contract-version         prepare <package.json> <intents-dir> <state.json>
gha.mjs contract-version         finalize <state.json> <releases.json>
gha.mjs github-releases          <publish-summary.json> <workspace-list.json> [published|staged]
gha.mjs release-pr-body          <releases.json> <workspace-list.json>
gha.mjs shared-workflows-release <package.json> <workflows-dir>
gha.mjs signed-commit            <branch> <message>
```

Each lives in `src/commands/` as a thin argument-parsing adapter over a tested
module in `src/`. A test cross-checks that every command the workflows invoke is
registered.

## Working on it

```sh
pnpm --filter @zemd/gha run test
pnpm --filter @zemd/gha run build   # regenerate .github/scripts, then commit it
```

Never edit `.github/scripts` by hand. CI rebuilds and fails on any difference.

`scripts/sync.ts` runs under Node's type stripping, so keep its syntax erasable.
