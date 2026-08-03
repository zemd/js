---
"@zemd/tsconfig": minor
---

Add `tsconfig-library.json`, a config for libraries that ship bundled output.

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
