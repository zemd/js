# @zemd/tsconfig

[![npm](https://img.shields.io/npm/v/@zemd/tsconfig?color=0000ff&label=npm&labelColor=000)](https://npmjs.com/package/@zemd/tsconfig)

Shared TypeScript configs with strict defaults for React libraries, Next.js apps, and Node.js projects.

## Configs

| Config                | Target | Module             | Key features             |
| --------------------- | ------ | ------------------ | ------------------------ |
| `tsconfig-react.json` | ESNext | ESNext (Bundler)   | JSX, DOM types           |
| `tsconfig-next.json`  | ESNext | Preserve (Bundler) | Next.js plugin, `noEmit` |
| `tsconfig-node.json`  | ES2025 | NodeNext           | Node.js types            |

All configs extend `tsconfig-base.json` which enables `strict` mode, `verbatimModuleSyntax`, `isolatedDeclarations`, `erasableSyntaxOnly`, and other strict checks.

## Install

```sh
npm install @zemd/tsconfig --save-dev
```

## Usage

### React library

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "@zemd/tsconfig/tsconfig-react.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*.ts", "src/**/*.tsx"],
  "exclude": ["node_modules", "dist", "**/*.test.ts", "**/*.test.tsx"]
}
```

### Next.js app

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "@zemd/tsconfig/tsconfig-next.json",
  "include": ["next-env.d.ts", "src/**/*.ts", "src/**/*.tsx"],
  "exclude": ["node_modules", ".next"]
}
```

### Node.js project

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "@zemd/tsconfig/tsconfig-node.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

### Monorepo

In a monorepo, use a solution-style root `tsconfig.json` that references each package. Each package then extends the appropriate config and enables `composite` for project references.

**Root `tsconfig.json`** — does not compile anything, only wires packages together:

```json
{
  "files": [],
  "references": [
    { "path": "packages/ui" },
    { "path": "packages/utils" },
    { "path": "packages/web" }
  ]
}
```

**`packages/ui/tsconfig.json`** — a React component library:

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "@zemd/tsconfig/tsconfig-react.json",
  "compilerOptions": {
    "composite": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*.ts", "src/**/*.tsx"],
  "exclude": ["node_modules", "dist"],
  "references": [{ "path": "../utils" }]
}
```

**`packages/utils/tsconfig.json`** — a shared Node.js utility package:

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "@zemd/tsconfig/tsconfig-node.json",
  "compilerOptions": {
    "composite": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

Then build the entire project graph with:

```sh
tsc --build
```

> **Tip:** The base config already enables `declaration`, `declarationMap`, and `isolatedDeclarations` — which means fast, parallelizable declaration emit and full cross-package IDE navigation out of the box.

## Compatibility

These configs target the **latest LTS Node.js** (currently **Node.js 24**) and are designed for **TypeScript 6.0**+, with the latest versions of **React** and **Next.js** in mind. If you're on an older Node.js or TypeScript version, you may need to adjust `target`, `module`, or `lib` settings in your own `tsconfig.json`.

## Notes

- You must set `outDir` and `rootDir` yourself - TypeScript treats these as relative paths, so they should live in your own `tsconfig.json`.
- When extending `tsconfig-next.json`, make sure `next-env.d.ts` is in the `include` array (it is by default). If you override `include`, add it back manually.
- The base config includes `watchOptions` that uses `useFsEventsOnParentDirectory` and excludes `**/node_modules`, `dist`, and `tmp` directories. To extend or override, add your own `watchOptions` in your `tsconfig.json`:
  ```json
  {
    "watchOptions": {
      "excludeDirectories": ["**/node_modules", "dist", "tmp", ".next"]
    }
  }
  ```

## License

@zemd/tsconfig is released under the MIT license.

## Donate

[![](https://img.shields.io/badge/patreon-donate-yellow.svg)](https://www.patreon.com/red_rabbit)
[![](https://img.shields.io/static/v1?label=UNITED24&message=support%20Ukraine&color=blue)](https://u24.gov.ua/)
