import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";

import { commands } from "../commands/index.ts";
import { planContractVersion } from "../contract-version.ts";
import {
  BUNDLE,
  dependabotUpdater,
  examplesDir,
  read,
  root,
  scriptsDir,
  usesAction,
  usesReferences,
  workflowJob,
  workflowStep,
  workflowsDir,
  yamlFiles,
  yamlStringList,
} from "../testing/workflows.ts";

// `node .github/scripts/gha.mjs <command>` or `node "${SHARED_CLI}" <command>`,
// on one line so the `SHARED_CLI` declaration itself is not mistaken for a call.
const INVOCATION = /(?:gha\.mjs|\$\{SHARED_CLI\})"?[ ]+([a-z-]+)/g;

const workflowJavaScript = (step: string): string => {
  const lines = step.split("\n");
  const marker = lines.findIndex((line) => line.trim() === "script: |");
  if (marker < 0) throw new Error("Workflow step does not contain an inline script");

  const markerLine = lines[marker];
  if (markerLine === undefined) throw new Error("Workflow script marker is missing");
  const indentation = markerLine.length - markerLine.trimStart().length + 2;
  const prefix = " ".repeat(indentation);

  return lines
    .slice(marker + 1)
    .map((line) => {
      if (line.length === 0) return "";
      if (!line.startsWith(prefix)) throw new Error("Workflow script indentation is invalid");
      return line.slice(indentation);
    })
    .join("\n");
};

const runWorkflowJavaScript = async (
  step: string,
  globals: Record<string, unknown>,
): Promise<void> => {
  const result: unknown = runInNewContext(
    "(async () => {\n" + workflowJavaScript(step) + "\n})()",
    globals,
  );
  await result;
};

void test("zizmor is configured to fail the workflow on every finding", () => {
  const source = read(workflowsDir, "shared-zizmor.yml");
  const caller = read(workflowsDir, "repo-zizmor.yml");
  const manifest = JSON.parse(readFileSync(`${root}package.json`, "utf8")) as {
    scripts: Record<string, string>;
  };

  assert.ok(usesAction(source, "zizmorcore/zizmor-action"));
  assert.match(source, /^ {10}version: "1\.29\.0"$/m);
  assert.match(source, /^ {10}collect: default$/m);
  assert.match(source, /^ {10}online-audits: true$/m);
  assert.match(source, /^ {10}advanced-security: false$/m);
  assert.match(source, /^ {10}annotations: true$/m);
  assert.match(source, /^ {10}fail-on-no-inputs: true$/m);
  assert.ok(!source.includes("security-events:"));
  assert.match(caller, /^ {6}persona: pedantic$/m);
  assert.strictEqual(
    manifest.scripts["lint-actions"],
    "zizmor --strict-collection --collect=default --persona=pedantic .",
  );
});

void test("Release Branchkeeper adds missing changesets for shared action updates", () => {
  const source = read(workflowsDir, "repo-pr-automation-shared-action-release-intent.yml");
  const detect = workflowJob(source, "detect");
  const commit = workflowJob(source, "commit");
  const token = workflowStep(source, "Create Release Branchkeeper token");
  const createChangeset = workflowStep(source, "Commit the changeset");

  assert.match(
    source,
    /^ {2}workflow_run:\n {4}workflows:\n {6}- CI\n {4}types:\n {6}- requested\n {6}- completed$/m,
  );
  assert.ok(source.includes("zizmor: ignore[dangerous-triggers]"));
  assert.doesNotMatch(source, /pull_request_target|actions\/checkout/);

  assert.ok(detect.includes("pull.head.repo?.full_name !== repository"));
  assert.ok(detect.includes('new Set(["zemd", "dependabot[bot]"])'));
  assert.ok(detect.includes('pull.head.ref === "release/main"'));
  assert.ok(detect.includes("trustedAuthors.has(pull.user?.login"));
  assert.ok(detect.includes("pull.head.sha !== workflowRun.head_sha"));
  assert.ok(detect.includes("github.paginate(github.rest.pulls.listFiles"));
  assert.ok(detect.includes("github.rest.repos.getContent"));
  assert.ok(detect.includes("action.identity === afterActions[index]?.identity"));
  assert.ok(detect.includes("beforeSnapshot.shape !== afterSnapshot.shape"));
  assert.ok(detect.includes("hasReleaseIntent(source)"));
  assert.doesNotMatch(detect, /source\.includes\([^\n]*@zemd\/gha/);
  assert.ok(detect.includes('core.setOutput("required", "true")'));
  assert.doesNotMatch(detect, /RELEASE_BRANCHKEEPER/);

  assert.ok(commit.includes("if: needs.detect.outputs.required == 'true'"));
  assert.ok(usesAction(token, "actions/create-github-app-token"));
  assert.ok(token.includes("client-id: ${{ vars.RELEASE_BRANCHKEEPER_CLIENT_ID }}"));
  assert.ok(token.includes("private-key: ${{ secrets.RELEASE_BRANCHKEEPER_PRIVATE_KEY }}"));
  assert.ok(token.includes("owner: ${{ github.repository_owner }}"));
  assert.ok(token.includes("repositories: ${{ github.repository }}"));
  assert.ok(token.includes("permission-contents: write"));
  assert.ok(token.includes("permission-pull-requests: read"));
  assert.doesNotMatch(token, /PUBLISHER|release-publisher/);

  assert.ok(
    createChangeset.includes("github-token: ${{ steps.release-branchkeeper-token.outputs.token }}"),
  );
  assert.ok(createChangeset.includes("createCommitOnBranch(input: $input)"));
  assert.ok(createChangeset.includes("expectedHeadOid"));
  assert.ok(createChangeset.includes('pull.head.ref === "release/main"'));
  assert.ok(createChangeset.includes("trustedAuthors.has(pull.user?.login"));
  assert.ok(createChangeset.includes('"@zemd/gha": patch'));
  assert.ok(createChangeset.includes(".changeset/shared-actions-"));
  assert.ok(createChangeset.includes("chore: add changeset for action updates"));
});

void test("the shared-action detector requires an action change without an existing intent", async () => {
  const source = read(workflowsDir, "repo-pr-automation-shared-action-release-intent.yml");
  const step = workflowStep(source, "Detect an action update without a changeset");
  const baseSha = "a".repeat(40);
  const headSha = "b".repeat(40);
  const workflowPath = ".github/workflows/shared-ci.yml";

  const detect = async (
    before: string,
    after: string,
    {
      author = "dependabot[bot]",
      changeset,
      headRef = "dependabot/github_actions/update",
    }: { author?: string; changeset?: string; headRef?: string } = {},
  ): Promise<string> => {
    const outputs = new Map<string, string>();
    const files = [
      { filename: workflowPath, status: "modified" },
      ...(changeset === undefined ? [] : [{ filename: ".changeset/already.md", status: "added" }]),
    ];

    await runWorkflowJavaScript(step, {
      Buffer,
      context: {
        payload: {
          workflow_run: {
            event: "pull_request",
            head_sha: headSha,
            pull_requests: [{ number: 57 }],
          },
        },
        repo: { owner: "zemd", repo: "js" },
      },
      core: {
        info: () => undefined,
        setOutput: (name: string, value: string) => outputs.set(name, value),
      },
      github: {
        paginate: () => Promise.resolve(files),
        rest: {
          pulls: {
            get: () =>
              Promise.resolve({
                data: {
                  base: { ref: "main", sha: baseSha },
                  head: {
                    ref: headRef,
                    repo: { full_name: "zemd/js" },
                    sha: headSha,
                  },
                  number: 57,
                  state: "open",
                  user: { login: author },
                },
              }),
            listFiles: () => Promise.resolve(),
          },
          repos: {
            getContent: ({ path, ref }: { path: string; ref: string }) => {
              const content =
                path === workflowPath ? (ref === baseSha ? before : after) : (changeset ?? "");
              return Promise.resolve({
                data: {
                  content: Buffer.from(content).toString("base64"),
                  type: "file",
                },
              });
            },
          },
        },
      },
    });

    return outputs.get("required") ?? "";
  };

  assert.strictEqual(
    await detect(
      "uses: actions/checkout@1111111111111111111111111111111111111111 # v7",
      "uses: actions/checkout@2222222222222222222222222222222222222222 # v7",
    ),
    "true",
  );
  assert.strictEqual(
    await detect(
      "uses: actions/checkout@1111111111111111111111111111111111111111 # v7.0.0",
      "uses: actions/checkout@2222222222222222222222222222222222222222 # v7.0.1",
    ),
    "true",
  );
  assert.strictEqual(
    await detect(
      "uses: actions/checkout@1111111111111111111111111111111111111111 # v7.0.0",
      "uses: actions/checkout@1111111111111111111111111111111111111111 # v7.0.1",
    ),
    "false",
  );
  assert.strictEqual(
    await detect(
      "uses: actions/checkout@1111111111111111111111111111111111111111 # v7",
      "uses: actions/checkout@2222222222222222222222222222222222222222 # v7",
      { changeset: '---\n"@zemd/gha": patch\n---\n' },
    ),
    "false",
  );
  assert.strictEqual(
    await detect(
      "uses: actions/checkout@1111111111111111111111111111111111111111 # v7",
      "uses: step-security/harden-runner@2222222222222222222222222222222222222222 # v2",
    ),
    "false",
  );
  assert.strictEqual(
    await detect(
      "uses: actions/checkout@1111111111111111111111111111111111111111 # v7",
      [
        "uses: actions/checkout@2222222222222222222222222222222222222222 # v7",
        "uses: actions/setup-node@3333333333333333333333333333333333333333 # v7",
      ].join("\n"),
    ),
    "false",
  );
  assert.strictEqual(
    await detect(
      [
        "uses: actions/checkout@1111111111111111111111111111111111111111 # v7",
        "uses: actions/setup-node@3333333333333333333333333333333333333333 # v7",
      ].join("\n"),
      "uses: actions/checkout@2222222222222222222222222222222222222222 # v7",
    ),
    "false",
  );
  assert.strictEqual(
    await detect(
      [
        "permissions: read-all",
        "uses: actions/checkout@1111111111111111111111111111111111111111 # v7.0.0",
      ].join("\n"),
      [
        "permissions: write-all",
        "uses: actions/checkout@2222222222222222222222222222222222222222 # v7.0.1",
      ].join("\n"),
    ),
    "false",
  );
  assert.strictEqual(
    await detect(
      "uses: actions/checkout@1111111111111111111111111111111111111111 # v7",
      "uses: actions/checkout@2222222222222222222222222222222222222222 # v7",
      { changeset: '---\n"another-package": patch\n---\n\nMentions "@zemd/gha".\n' },
    ),
    "true",
  );
  assert.strictEqual(
    await detect(
      "uses: actions/checkout@1111111111111111111111111111111111111111 # v7",
      "uses: actions/checkout@2222222222222222222222222222222222222222 # v7",
      { changeset: '---\n"@zemd/gha": invalid\n---\n' },
    ),
    "true",
  );
  assert.strictEqual(
    await detect(
      "uses: actions/checkout@1111111111111111111111111111111111111111 # v7",
      "uses: actions/checkout@2222222222222222222222222222222222222222 # v7",
      { changeset: "---\n\"@zemd/gha\": invalid\n'@zemd/gha': minor\n---\n" },
    ),
    "false",
  );
  assert.strictEqual(
    await detect(
      "uses: actions/checkout@1111111111111111111111111111111111111111 # v7",
      "uses: actions/checkout@2222222222222222222222222222222222222222 # v7",
      { author: "zemd" },
    ),
    "true",
  );
  assert.strictEqual(
    await detect(
      "uses: actions/checkout@1111111111111111111111111111111111111111 # v7",
      "uses: actions/checkout@2222222222222222222222222222222222222222 # v7",
      { author: "someone-else" },
    ),
    "false",
  );
  assert.strictEqual(
    await detect(
      "uses: actions/checkout@1111111111111111111111111111111111111111 # v7",
      "uses: actions/checkout@2222222222222222222222222222222222222222 # v7",
      { headRef: "release/main" },
    ),
    "false",
  );
});

void test("the Branchkeeper step creates only the fixed changeset commit", async () => {
  const source = read(workflowsDir, "repo-pr-automation-shared-action-release-intent.yml");
  const step = workflowStep(source, "Commit the changeset");
  const headSha = "b".repeat(40);
  let mutationInput: unknown;

  await runWorkflowJavaScript(step, {
    Buffer,
    context: { repo: { owner: "zemd", repo: "js" } },
    core: {
      info: () => undefined,
      notice: () => undefined,
    },
    github: {
      graphql: (_mutation: string, variables: { input: unknown }) => {
        mutationInput = variables.input;
        return Promise.resolve({
          createCommitOnBranch: { commit: { oid: "c".repeat(40) } },
        });
      },
      rest: {
        pulls: {
          get: () =>
            Promise.resolve({
              data: {
                base: { ref: "main" },
                head: {
                  ref: "dependabot/github_actions/update",
                  repo: { full_name: "zemd/js" },
                  sha: headSha,
                },
                number: 57,
                state: "open",
                user: { login: "dependabot[bot]" },
              },
            }),
        },
        repos: {
          getContent: () => Promise.reject(Object.assign(new Error("not found"), { status: 404 })),
        },
      },
    },
    process: {
      env: {
        EXPECTED_HEAD_SHA: headSha,
        PR_NUMBER: "57",
      },
    },
  });

  const normalizedMutationInput: unknown = JSON.parse(JSON.stringify(mutationInput));
  assert.deepStrictEqual(normalizedMutationInput, {
    branch: {
      repositoryNameWithOwner: "zemd/js",
      branchName: "dependabot/github_actions/update",
    },
    expectedHeadOid: headSha,
    message: {
      headline: "chore: add changeset for action updates",
    },
    fileChanges: {
      additions: [
        {
          path: ".changeset/shared-actions-57.md",
          contents: Buffer.from(
            '---\n"@zemd/gha": patch\n---\n\n' +
              "Update the action versions used by the shared GitHub Actions workflows.\n",
          ).toString("base64"),
        },
      ],
    },
  });
});

void test("Branchkeeper revalidates the author and release branch before writing", async () => {
  const source = read(workflowsDir, "repo-pr-automation-shared-action-release-intent.yml");
  const step = workflowStep(source, "Commit the changeset");
  const headSha = "b".repeat(40);

  for (const { author, headRef } of [
    { author: "someone-else", headRef: "feature/action-update" },
    { author: "zemd", headRef: "release/main" },
  ]) {
    let wrote = false;
    await runWorkflowJavaScript(step, {
      Buffer,
      context: { repo: { owner: "zemd", repo: "js" } },
      core: { info: () => undefined },
      github: {
        graphql: () => {
          wrote = true;
          return Promise.resolve({});
        },
        rest: {
          pulls: {
            get: () =>
              Promise.resolve({
                data: {
                  base: { ref: "main" },
                  head: {
                    ref: headRef,
                    repo: { full_name: "zemd/js" },
                    sha: headSha,
                  },
                  number: 57,
                  state: "open",
                  user: { login: author },
                },
              }),
          },
          repos: {
            getContent: () => {
              wrote = true;
              return Promise.resolve({});
            },
          },
        },
      },
      process: {
        env: {
          EXPECTED_HEAD_SHA: headSha,
          PR_NUMBER: "57",
        },
      },
    });

    assert.strictEqual(wrote, false, `${author} on ${headRef} must not receive a commit`);
  }
});

void test("Dependabot npm cooldowns match pnpm's release-age policy", () => {
  const workspace = readFileSync(`${root}pnpm-workspace.yaml`, "utf8");
  const configuredMinimumReleaseAge = workspace.match(/^minimumReleaseAge: (\d+)$/m)?.[1];
  if (configuredMinimumReleaseAge === undefined) {
    throw new Error("pnpm must explicitly configure minimumReleaseAge");
  }

  const minimumReleaseAgeMinutes = Number(configuredMinimumReleaseAge);
  assert.strictEqual(minimumReleaseAgeMinutes % 1440, 0);
  assert.match(workspace, /^minimumReleaseAgeStrict: true$/m);
  assert.match(workspace, /^minimumReleaseAgeIgnoreMissingTime: false$/m);
  assert.match(workspace, /^trustPolicy: no-downgrade$/m);

  const cooldownDays = minimumReleaseAgeMinutes / 1440;
  const broadExclusions = yamlStringList(workspace, "minimumReleaseAgeExclude", 0).filter(
    (selector) =>
      selector.startsWith("@") ? selector.indexOf("@", 1) < 0 : !selector.includes("@"),
  );
  assert.deepStrictEqual(broadExclusions, ["@zemd/*"]);
  assert.match(workspace, /^ {2}- "@zemd\/\*"$/m);

  for (const [directory, file] of [
    [`${root}.github/`, "dependabot.yml"],
    [examplesDir, "dependabot.yml"],
  ] as const) {
    const npm = dependabotUpdater(read(directory, file), "npm");

    assert.match(
      npm,
      new RegExp(`^ {6}default-days: ${cooldownDays}(?: |$)`, "m"),
      `${file} must match pnpm's minimumReleaseAge`,
    );
    assert.deepStrictEqual(yamlStringList(npm, "exclude", 6), broadExclusions);
  }
});

void test("repository-local secret and editor defaults are hardened", () => {
  const ignored = readFileSync(`${root}.gitignore`, "utf8");
  for (const pattern of [".env", ".env.*", "*.pem", "*.key", "*.p12", "*.pfx", ".npmrc"]) {
    assert.match(
      ignored,
      new RegExp(`^${pattern.replaceAll(".", "\\.").replaceAll("*", ".*")}$`, "m"),
    );
  }
  assert.match(ignored, /^!\.env\.example$/m);
  assert.match(ignored, /^!\.env\.\*\.example$/m);

  const devcontainer = JSON.parse(
    readFileSync(`${root}.devcontainer/devcontainer.json`, "utf8"),
  ) as { customizations: { vscode: { extensions: string[] } } };
  for (const extension of devcontainer.customizations.vscode.extensions) {
    assert.match(extension, /^[\w.-]+\.[\w.-]+@\d+\.\d+\.\d+$/);
  }

  const policy = readFileSync(`${root}SECURITY.md`, "utf8");
  assert.ok(policy.includes("within two business days"));
  assert.ok(policy.includes("CVSS v4.0"));
  assert.ok(policy.includes("demonstrably exploitable through a supported package"));
});

void test("every public package requests npm provenance", () => {
  for (const directory of [`${root}packages/`, `${root}http-clients/`]) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const path = `${directory}${entry.name}/package.json`;
      const manifest = JSON.parse(readFileSync(path, "utf8")) as {
        name?: string;
        private?: boolean;
        publishConfig?: { provenance?: boolean };
      };
      if (manifest.private === true) continue;
      assert.strictEqual(
        manifest.publishConfig?.provenance,
        true,
        `${manifest.name ?? path} must publish with provenance`,
      );
    }
  }
});

void test("Dependabot keeps GitHub Actions behind a seven-day cooldown", () => {
  for (const [directory, file] of [
    [`${root}.github/`, "dependabot.yml"],
    [examplesDir, "dependabot.yml"],
  ] as const) {
    const githubActions = dependabotUpdater(read(directory, file), "github-actions");
    assert.match(githubActions, /^ {6}default-days: 7$/m);
  }
});

void test("examples pin the shared workflows through a replaceable placeholder", () => {
  const examples = yamlFiles(examplesDir);
  const contract = JSON.parse(readFileSync(`${root}internal/gha/package.json`, "utf8")) as {
    name: string;
    version: string;
  };
  const intents = readdirSync(`${root}.changeset/`)
    .filter((file) => file.endsWith(".md") && file.toLowerCase() !== "readme.md")
    .map((file) => ({ id: file, source: readFileSync(`${root}.changeset/${file}`, "utf8") }));
  const plannedVersion = planContractVersion(contract, intents)?.newVersion ?? contract.version;
  const expectedComment = `v${plannedVersion.split(".")[0]}`;
  assert.ok(examples.length > 0);

  for (const file of examples) {
    for (const { reference, comment } of usesReferences(read(examplesDir, file))) {
      assert.match(
        reference,
        /^zemd\/js\/\.github\/workflows\/shared-[a-z0-9-]+\.yml@__SHA__$/,
        `${file}: "${reference}" must reference a shared workflow`,
      );
      assert.strictEqual(
        comment,
        expectedComment,
        `${file}: "${reference}" must carry the current contract major comment`,
      );
    }
  }
});

void test("the committed tooling is a single generated bundle", () => {
  assert.deepStrictEqual(readdirSync(scriptsDir), [BUNDLE]);
  assert.match(read(scriptsDir, BUNDLE), /^\/\/ Generated by `pnpm --filter @zemd\/gha run sync`/);
});

void test("every command the workflows invoke is registered in the CLI", () => {
  const invoked = new Set<string>();

  for (const file of yamlFiles(workflowsDir)) {
    for (const [, command] of read(workflowsDir, file).matchAll(INVOCATION)) {
      if (command) invoked.add(command);
    }
  }

  assert.ok(invoked.size > 0);

  for (const command of invoked) {
    assert.ok(
      Object.keys(commands).includes(command),
      `a workflow invokes "${command}", which the CLI does not register`,
    );
  }
});
