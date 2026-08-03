# @zemd/tsconfig

## 2.1.0

### Minor Changes

- Add `tsconfig-library.json`, a config for libraries that ship bundled output.

  It extends `tsconfig-base.json` and targets ES2022 with `ESNext` modules and `Bundler`
  module resolution, so the source is type-checked the way a bundler resolves it. Source maps
  and declaration maps are disabled, and `skipLibCheck` is enabled, since the bundler emits the
  final artifacts and the maps that go with them.

  ```json
  {
    "$schema": "https://json.schemastore.org/tsconfig",
    "extends": "@zemd/tsconfig/tsconfig-library.json",
    "include": ["src/**/*.ts"],
    "exclude": ["node_modules", "dist", "**/*.test.ts"]
  }
  ```

## 2.0.0

### Major Changes

- 7333478: Modernize tsconfig defaults, enable stricter checks, and bump to ES2025

## 1.6.0

### Minor Changes

- e97ecd4: Prepare for for the Typescript 7.0

## 1.5.0

### Minor Changes

- 815e99e: add erasableSyntaxOnly and libReplacement in base config

## 1.4.0

### Minor Changes

- 7ab6ed6: update jsx setting for next.js config

## 1.3.0

### Minor Changes

- 45cfeca: slight changes in base config
