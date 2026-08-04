import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workflow = readFileSync(new URL("../workflows/release.yml", import.meta.url), "utf8");

void test("keeps OIDC with an npm token fallback for first publishes", () => {
  assert.match(workflow, /id-token: write # npm trusted publishing \(OIDC\)/);
  assert.match(workflow, /registry-url: "https:\/\/registry\.npmjs\.org"/);
  assert.match(
    workflow,
    /- name: Publish to npm\n\s+env:\n(?:\s+#.*\n){2}\s+NODE_AUTH_TOKEN: \$\{\{ secrets\.NPM_TOKEN \}\}\n\s+run: pnpm publish -r/,
  );
});
