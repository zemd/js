import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";

import { commands } from "./commands";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const workflowsDir = `${root}.github/workflows/`;
const examplesDir = `${root}.github/workflows-examples/`;
const scriptsDir = `${root}.github/scripts/`;

const BUNDLE = "gha.mjs";

const yamlFiles = (directory: string): string[] =>
  readdirSync(directory).filter((file) => file.endsWith(".yml"));

const read = (directory: string, file: string): string => readFileSync(directory + file, "utf8");

// `- uses: owner/repo/path@ref # comment`
const USES = /^\s*(?:-\s+)?uses:\s*(\S+?)\s*(?:#\s*(\S+))?$/gm;

// `node .github/scripts/gha.mjs <command>` or `node "${SHARED_CLI}" <command>`,
// on one line so the `SHARED_CLI` declaration itself is not mistaken for a call.
const INVOCATION = /(?:gha\.mjs|\$\{SHARED_CLI\})"?[ ]+([a-z-]+)/g;

const usesReferences = (source: string): Array<{ reference: string; comment?: string }> =>
  [...source.matchAll(USES)].map(([, reference, comment]) => ({
    reference: reference ?? "",
    ...(comment === undefined ? {} : { comment }),
  }));

test("every action and workflow reference is pinned to a full commit SHA", () => {
  for (const file of yamlFiles(workflowsDir)) {
    for (const { reference, comment } of usesReferences(read(workflowsDir, file))) {
      // Same-repository calls resolve to the caller's own commit.
      if (reference.startsWith("./")) continue;

      expect(reference, `${file}: "${reference}" must be pinned to a commit SHA`).toMatch(
        /@[0-9a-f]{40}$/,
      );
      expect(comment, `${file}: "${reference}" must carry a "# <version>" comment`).toBeDefined();
    }
  }
});

test("shared workflows are callable and self-contained", () => {
  const shared = yamlFiles(workflowsDir).filter((file) => file.startsWith("shared-"));
  expect(shared.length).toBeGreaterThan(0);

  for (const file of shared) {
    const source = read(workflowsDir, file);
    expect(source, `${file} must only trigger on workflow_call`).toMatch(
      /^on:\n {2}workflow_call:$/m,
    );
    // `env` declared by a caller is never propagated into a reusable workflow.
    expect(source, `${file} must not read the caller's env context`).not.toContain("${{ env.");
  }
});

test("callers delegate to the shared workflows", () => {
  const callers: Array<[string, string]> = [
    ["ci.yml", "shared-ci.yml"],
    ["codeql.yml", "shared-codeql.yml"],
    ["scorecard.yml", "shared-scorecard.yml"],
    // npm trusted publishing validates the caller filename, so it is part of the contract.
    ["release.yml", "shared-release.yml"],
  ];

  for (const [caller, shared] of callers) {
    expect(read(workflowsDir, caller), `${caller} must call ${shared}`).toContain(
      `uses: ./.github/workflows/${shared}`,
    );
  }
});

test("shared workflows set the telemetry opt-out themselves", () => {
  for (const file of ["shared-ci.yml", "shared-release.yml"]) {
    expect(read(workflowsDir, file), `${file} must set DO_NOT_TRACK`).toMatch(
      /^ {2}DO_NOT_TRACK: 1$/m,
    );
  }
});

test("the release tooling is checked out from the pinned shared revision", () => {
  const source = read(workflowsDir, "shared-release.yml");

  // `actions/checkout` pulls the *caller* repository, so the CLI this workflow
  // runs has to come from a second checkout of its own revision.
  expect(source).toMatch(/repository: \$\{\{ job\.workflow_repository \}\}/);
  expect(source).toMatch(/ref: \$\{\{ job\.workflow_sha \}\}/);
  expect(source).toMatch(/path: \.shared-ci/);
  expect(source).toMatch(/echo "\/\.shared-ci\/" >> \.git\/info\/exclude/);
  expect(source).toContain(`SHARED_CLI: .shared-ci/.github/scripts/${BUNDLE}`);
});

test("keeps OIDC with an npm token fallback for first publishes", () => {
  const source = read(workflowsDir, "shared-release.yml");

  expect(source).toMatch(/id-token: write # npm trusted publishing \(OIDC\)/);
  expect(source).toMatch(/default: "https:\/\/registry\.npmjs\.org"/);
  expect(source).toMatch(/registry-url: \$\{\{ inputs\.registry-url \}\}/);
  expect(source).toMatch(
    /- name: Publish to npm\n\s+env:\n(?:\s+#.*\n){2}\s+NODE_AUTH_TOKEN: \$\{\{ secrets\.NPM_TOKEN \}\}\n\s+run: pnpm publish -r/,
  );
});

test("examples pin the shared workflows through a replaceable placeholder", () => {
  const examples = yamlFiles(examplesDir);
  expect(examples.length).toBeGreaterThan(0);

  for (const file of examples) {
    for (const { reference, comment } of usesReferences(read(examplesDir, file))) {
      expect(reference, `${file}: "${reference}" must reference a shared workflow`).toMatch(
        /^zemd\/js\/\.github\/workflows\/shared-[a-z]+\.yml@__SHA__$/,
      );
      expect(comment, `${file}: "${reference}" must carry a "# <version>" comment`).toBeDefined();
    }
  }
});

test("the committed tooling is a single generated bundle", () => {
  expect(readdirSync(scriptsDir)).toEqual([BUNDLE]);
  expect(read(scriptsDir, BUNDLE)).toMatch(
    /^\/\/ Generated by `pnpm --filter @zemd\/gha run build`/,
  );
});

test("every command the workflows invoke is registered in the CLI", () => {
  const invoked = new Set<string>();

  for (const file of yamlFiles(workflowsDir)) {
    for (const [, command] of read(workflowsDir, file).matchAll(INVOCATION)) {
      if (command) invoked.add(command);
    }
  }

  expect(invoked.size).toBeGreaterThan(0);

  for (const command of invoked) {
    expect(
      Object.keys(commands),
      `a workflow invokes "${command}", which the CLI does not register`,
    ).toContain(command);
  }
});

test("the release workflow reads the contract version from the package manifest", () => {
  expect(read(workflowsDir, "release.yml")).toContain(
    "gha.mjs shared-workflows-release internal/gha/package.json .github/workflows",
  );
});

test("the contract version is plain semver", () => {
  const manifest = JSON.parse(readFileSync(`${root}internal/gha/package.json`, "utf8")) as {
    version: string;
    private: boolean;
  };

  expect(manifest.version).toMatch(/^\d+\.\d+\.\d+$/);
  // A published package would drag the workflow contract into the npm release.
  expect(manifest.private).toBe(true);
});
