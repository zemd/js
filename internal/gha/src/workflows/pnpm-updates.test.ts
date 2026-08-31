import assert from "node:assert/strict";
import { test } from "node:test";
import { runInNewContext } from "node:vm";

import {
  examplesDir,
  read,
  usesAction,
  workflowJob,
  workflowStep,
  workflowsDir,
} from "../testing/workflows.ts";

const WORKFLOW = "shared-pnpm-update.yml";
const BASE_SHA = "a".repeat(40);
const PACKAGE_JSON = Buffer.from(JSON.stringify({ name: "example", private: true }) + "\n");

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

const normalized = (value: unknown): unknown => JSON.parse(JSON.stringify(value));

void test("the weekly caller keeps Corepack away from the Branchkeeper credential", () => {
  const source = read(workflowsDir, WORKFLOW);
  const caller = read(workflowsDir, "repo-pnpm-update.yml");
  const example = read(examplesDir, "repo-pnpm-update.yml");
  const prepare = workflowJob(source, "prepare");
  const pullRequest = workflowJob(source, "pull-request");
  const checkout = workflowStep(source, "Checkout default branch");
  const update = workflowStep(source, "Update pnpm with Corepack");
  const changed = workflowStep(source, "Check for pnpm update");
  const upload = workflowStep(source, "Upload pnpm update");
  const download = workflowStep(source, "Download pnpm update");
  const token = workflowStep(source, "Create Release Branchkeeper token");
  const open = workflowStep(source, "Open pnpm update pull request");

  for (const schedule of [caller, example]) {
    assert.match(schedule, /^on:\n {2}schedule:\n {4}- cron: "23 5 \* \* 1"$/m);
    assert.doesNotMatch(schedule, /workflow_dispatch|pull_request|push:/);
  }
  assert.match(prepare, /^ {4}if: github\.event_name == 'schedule'$/m);
  assert.ok(usesAction(checkout, "actions/checkout"));
  assert.ok(checkout.includes("ref: ${{ github.sha }}"));
  assert.ok(checkout.includes("persist-credentials: false"));
  assert.ok(update.includes('npm_config_ignore_scripts: "true"'));
  assert.ok(update.includes("corepack use pnpm@latest"));
  assert.ok(changed.includes("git diff --quiet --exit-code"));
  assert.ok(changed.includes("':(exclude)package.json'"));
  assert.ok(usesAction(upload, "actions/upload-artifact"));
  assert.ok(usesAction(download, "actions/download-artifact"));
  assert.doesNotMatch(prepare, /RELEASE_BRANCHKEEPER|create-github-app-token/);

  assert.doesNotMatch(source, /Read updated pnpm version|Validate pnpm update|stablePnpm/);
  assert.ok(
    pullRequest.indexOf("- name: Create Release Branchkeeper token") <
      pullRequest.indexOf("- name: Open pnpm update pull request"),
  );
  assert.ok(usesAction(token, "actions/create-github-app-token"));
  assert.ok(token.includes("client-id: ${{ inputs.release-branchkeeper-client-id }}"));
  assert.ok(token.includes("private-key: ${{ secrets.RELEASE_BRANCHKEEPER_PRIVATE_KEY }}"));
  assert.ok(token.includes("permission-contents: write"));
  assert.ok(token.includes("permission-pull-requests: write"));
  assert.ok(open.includes('const branchName = "automation/pnpm-update"'));
  assert.ok(open.includes('const title = "chore: update pnpm"'));
  assert.ok(open.includes("createCommitOnBranch(input: $input)"));
  assert.ok(open.includes('path: "package.json"'));
});

type PullRequestScenario = {
  branchExists?: boolean;
  openPulls?: Array<{ number: number }>;
};

const runPullRequest = async (
  scenario: PullRequestScenario = {},
): Promise<{
  createdRef?: unknown;
  updatedRef?: unknown;
  mutationInput?: unknown;
  listedPulls?: unknown;
  createdPull?: unknown;
}> => {
  const step = workflowStep(read(workflowsDir, WORKFLOW), "Open pnpm update pull request");
  let createdRef: unknown;
  let updatedRef: unknown;
  let mutationInput: unknown;
  let listedPulls: unknown;
  let createdPull: unknown;

  await runWorkflowJavaScript(step, {
    context: {
      payload: { repository: { default_branch: "main" } },
      repo: { owner: "zemd", repo: "js" },
      sha: BASE_SHA,
    },
    core: { notice: () => undefined },
    process: { env: { UPDATE_FILE: "/tmp/pnpm-update/package.json" } },
    require: (specifier: string) => {
      assert.strictEqual(specifier, "node:fs");
      return { readFileSync: () => PACKAGE_JSON };
    },
    github: {
      graphql: (_mutation: string, variables: { input: unknown }) => {
        mutationInput = variables.input;
        return Promise.resolve({ createCommitOnBranch: { commit: { oid: "b".repeat(40) } } });
      },
      rest: {
        git: {
          createRef: (input: unknown) => {
            createdRef = input;
            return Promise.resolve({ data: {} });
          },
          getRef: () =>
            scenario.branchExists === true
              ? Promise.resolve({ data: { object: { sha: "c".repeat(40) } } })
              : Promise.reject(Object.assign(new Error("not found"), { status: 404 })),
          updateRef: (input: unknown) => {
            updatedRef = input;
            return Promise.resolve({ data: {} });
          },
        },
        pulls: {
          create: (input: unknown) => {
            createdPull = input;
            return Promise.resolve({ data: { number: 57 } });
          },
          list: (input: unknown) => {
            listedPulls = input;
            return Promise.resolve({ data: scenario.openPulls ?? [] });
          },
        },
      },
    },
  });

  return {
    ...(createdRef === undefined ? {} : { createdRef }),
    ...(updatedRef === undefined ? {} : { updatedRef }),
    ...(mutationInput === undefined ? {} : { mutationInput }),
    ...(listedPulls === undefined ? {} : { listedPulls }),
    ...(createdPull === undefined ? {} : { createdPull }),
  };
};

void test("Branchkeeper creates the fixed pnpm branch, commit, and pull request", async () => {
  const result = await runPullRequest();

  assert.deepStrictEqual(normalized(result.createdRef), {
    owner: "zemd",
    repo: "js",
    ref: "refs/heads/automation/pnpm-update",
    sha: BASE_SHA,
  });
  assert.strictEqual(result.updatedRef, undefined);
  assert.deepStrictEqual(normalized(result.mutationInput), {
    branch: {
      repositoryNameWithOwner: "zemd/js",
      branchName: "automation/pnpm-update",
    },
    expectedHeadOid: BASE_SHA,
    message: { headline: "chore: update pnpm" },
    fileChanges: {
      additions: [{ path: "package.json", contents: PACKAGE_JSON.toString("base64") }],
    },
  });
  assert.deepStrictEqual(normalized(result.listedPulls), {
    owner: "zemd",
    repo: "js",
    head: "zemd:automation/pnpm-update",
    base: "main",
    state: "open",
  });
  assert.deepStrictEqual(normalized(result.createdPull), {
    owner: "zemd",
    repo: "js",
    head: "automation/pnpm-update",
    base: "main",
    title: "chore: update pnpm",
    body: "Updates pnpm to the latest version with Corepack.",
  });
});

void test("Branchkeeper refreshes the fixed branch when its pull request is open", async () => {
  const result = await runPullRequest({ branchExists: true, openPulls: [{ number: 57 }] });

  assert.strictEqual(result.createdRef, undefined);
  assert.deepStrictEqual(normalized(result.updatedRef), {
    owner: "zemd",
    repo: "js",
    ref: "heads/automation/pnpm-update",
    sha: BASE_SHA,
    force: true,
  });
  assert.strictEqual(result.createdPull, undefined);
});
