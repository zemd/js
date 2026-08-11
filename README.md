# zemd/js

[![Node.js](https://img.shields.io/badge/node-%3E%3D24-000?labelColor=000&color=0000ff)](https://nodejs.org)
[![pnpm](https://img.shields.io/badge/pnpm-workspace-000?labelColor=000&color=0000ff)](https://pnpm.io)
[![Turborepo](https://img.shields.io/badge/turborepo-monorepo-000?labelColor=000&color=0000ff)](https://turborepo.com)
[![fast-check](https://img.shields.io/badge/property%20testing-fast--check-000?labelColor=000&color=0000ff)](https://fast-check.dev)

A monorepo of small, focused libraries for JavaScript environments — browsers, Node.js, and other modern runtimes.

Everything here is written in TypeScript and ships with type definitions, so you get autocompletion and type safety out of the box whether your own project uses TypeScript or plain JavaScript. The packages are ESM-only, tree-shakeable, and keep external dependencies to a minimum, so you only pay for what you actually import.

Each package is published independently to npm, using the `@zemd` and `@logtown` scopes where applicable — pick just the one you need.

## Packages

### Libraries

| Package                                     | Version                                                                                                                                     | License         | Description                                          |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | --------------- | ---------------------------------------------------- |
| [`@zemd/color`](packages/color)             | [![npm](https://img.shields.io/npm/v/@zemd/color?color=0000ff&label=npm&labelColor=000)](https://npmjs.com/package/@zemd/color)             | `Apache-2.0`    | Typed sRGB, OKLab, and OKLCH color utilities         |
| [`@zemd/std-modules`](packages/std)         | [![npm](https://img.shields.io/npm/v/@zemd/std-modules?color=0000ff&label=npm&labelColor=000)](https://npmjs.com/package/@zemd/std-modules) | `BlueOak-1.0.0` | Standalone ECMAScript modules for diverse use cases  |
| [`@zemd/http-client`](packages/http-client) | [![npm](https://img.shields.io/npm/v/@zemd/http-client?color=0000ff&label=npm&labelColor=000)](https://npmjs.com/package/@zemd/http-client) | `Apache-2.0`    | A lightweight framework to build your custom `fetch` |
| [`@zemd/openapi`](packages/openapi)         | [![npm](https://img.shields.io/npm/v/@zemd/openapi?color=0000ff&label=npm&labelColor=000)](https://npmjs.com/package/@zemd/openapi)         | `Apache-2.0`    | OpenAPI TypeScript definitions and tools             |
| [`@zemd/testing`](packages/testing)         | [![npm](https://img.shields.io/npm/v/@zemd/testing?color=0000ff&label=npm&labelColor=000)](https://npmjs.com/package/@zemd/testing)         | `Apache-2.0`    | Focused helpers for Node.js native tests             |
| [`@zemd/tsconfig`](packages/tsconfig)       | [![npm](https://img.shields.io/npm/v/@zemd/tsconfig?color=0000ff&label=npm&labelColor=000)](https://npmjs.com/package/@zemd/tsconfig)       | `MIT`           | Shared TypeScript configs with strict defaults       |
| [`logtown`](packages/logtown)               | [![npm](https://img.shields.io/npm/v/logtown?color=0000ff&label=npm&labelColor=000)](https://npmjs.com/package/logtown)                     | `Apache-2.0`    | Versatile logging wrapper for JavaScript projects    |
| [`@logtown/hono`](packages/logtown-hono)    | [![npm](https://img.shields.io/npm/v/@logtown/hono?color=0000ff&label=npm&labelColor=000)](https://npmjs.com/package/@logtown/hono)         | `Apache-2.0`    | Hono middleware for logging with `logtown`           |

### HTTP clients

| Package                                        | Version                                                                                                                                             | License      | Description                                               |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | --------------------------------------------------------- |
| [`@zemd/figma-rest-api`](http-clients/figma)   | [![npm](https://img.shields.io/npm/v/@zemd/figma-rest-api?color=0000ff&label=npm&labelColor=000)](https://npmjs.com/package/@zemd/figma-rest-api)   | `Apache-2.0` | Lightweight, fetch-based, type-safe Figma REST API client |
| [`@zemd/flickr-rest-api`](http-clients/flickr) | [![npm](https://img.shields.io/npm/v/@zemd/flickr-rest-api?color=0000ff&label=npm&labelColor=000)](https://npmjs.com/package/@zemd/flickr-rest-api) | `Apache-2.0` | Flickr API client simplified                              |

## Getting started

```sh
git clone https://github.com/zemd/js.git
cd js
pnpm install
```

A normal install also configures this checkout's local `core.hooksPath` to
`.githooks`. CI sets `CI=true`, so dependency installation there skips local Git
hook configuration.

> [!NOTE]
> The repository uses [pnpm](https://pnpm.io) workspaces. Install it with `corepack enable` or follow the [pnpm installation guide](https://pnpm.io/installation).

### Dev Container

The checked-in [Dev Container configuration](.devcontainer/devcontainer.json) provides the repository's pinned Node.js, pnpm, and zizmor versions. In VS Code, run **Dev Containers: Reopen in Container**. The first container creation installs the frozen workspace dependencies and the Chromium build used by Playwright tests.

## Scripts

All tasks are orchestrated by [Turborepo](https://turborepo.com) and run across every workspace package.

| Command                      | Description                                       |
| ---------------------------- | ------------------------------------------------- |
| `pnpm build`                 | Build all packages                                |
| `pnpm test`                  | Run unit tests with Node.js's native test runner  |
| `pnpm test-coverage`         | Run unit tests and write native LCOV reports      |
| `pnpm test-browser`          | Run browser tests with Playwright                 |
| `pnpm test-browser-setup`    | Download the Chromium build used by browser tests |
| `pnpm test-git-hooks`        | Test the native Git hook behavior                 |
| `pnpm typecheck`             | Type-check all packages                           |
| `pnpm format`                | Format the codebase with `oxfmt`                  |
| `pnpm format-check`          | Verify formatting without writing changes         |
| `pnpm lint-fix`              | Run type-aware linting and auto-fix with `oxlint` |
| `pnpm lint-check`            | Run type-aware linting and fail on warnings       |
| `pnpm lint-actions`          | Audit GitHub Actions with `zizmor`                |
| `pnpm lint-publish`          | Validate publishable package metadata (`publint`) |
| `pnpm pre-commit`            | Format, lint-fix, validate, and stage all files   |
| `pnpm pre-push`              | Run the complete local pre-push validation graph  |
| `pnpm run git-hooks-install` | Install this checkout's native Git hooks          |

`pnpm lint-actions` requires [`zizmor`](https://docs.zizmor.sh/installation/)
1.29.0, matching the exact version pinned by CI. Set `GH_TOKEN` (for example,
from `gh auth token`) to include online audits when running it locally.

To run a script for a single package, use the workspace filter:

```sh
pnpm --filter @zemd/http-client build
```

## Security

To report a vulnerability, follow [`SECURITY.md`](SECURITY.md).

## Contributing

Issues and pull requests are welcome. Native hooks install automatically during
`pnpm install`. The pre-commit hook runs repository-wide lint fixes and
formatting, runs optional workspace `pre-commit` scripts, then stages all
resulting changes.

The pre-commit and pre-push coordinators are executable extensionless Bash hooks
under `.githooks`; the installer is `.githooks/install.sh`.

Packages opt into additional hook validation by defining a `pre-commit` or
`pre-push` script in their `package.json`. Turbo discovers each matching package
task once. These package tasks must be deterministic and read-only; central
`format` and `lint-fix` are the only mutating pre-commit tasks. Any future task
with side effects must also disable Turbo caching explicitly.

The pre-push hook runs builds, type checks, publication metadata checks, tests,
and package `pre-push` tasks. Hooks can be bypassed, so CI remains authoritative.
Before opening a PR, please make sure that
`pnpm lint-check`, `pnpm lint-actions`, `pnpm format-check`, `pnpm typecheck`,
`pnpm build`, `pnpm test`, `pnpm lint-publish`, and `pnpm test-browser` all pass.

## License

Each package declares its own license — see the table above and the `LICENSE` file inside every package directory. Unless stated otherwise, packages are released under **Apache-2.0** 😇.

## 💙 💛 Donate

[![](https://img.shields.io/static/v1?label=UNITED24&message=support%20Ukraine&color=blue)](https://u24.gov.ua/)
