import assert from "node:assert/strict";
import { test } from "node:test";
import { runInNewContext } from "node:vm";

import { read, usesAction, workflowJob, workflowStep, workflowsDir } from "../testing/workflows.ts";

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

const WORKFLOW = "repo-changeset-oxfmt-updates.yml";

void test("oxfmt updates run formatting without exposing the commit credential", () => {
  const source = read(workflowsDir, WORKFLOW);
  const detect = workflowJob(source, "detect");
  const format = workflowJob(source, "format");
  const commit = workflowJob(source, "commit");
  const formatFiles = workflowStep(source, "Format files");
  const collect = workflowStep(source, "Collect formatted files");
  const validate = workflowStep(source, "Validate formatted files");
  const token = workflowStep(source, "Create Release Branchkeeper token");
  const createCommit = workflowStep(source, "Commit formatted files");

  assert.match(
    source,
    /^ {2}workflow_run:\n {4}workflows:\n {6}- CI\n {4}types:\n {6}- requested\n {6}- completed$/m,
  );
  assert.ok(source.includes("zizmor: ignore[dangerous-triggers]"));
  assert.doesNotMatch(source, /pull_request_target/);

  assert.ok(detect.includes('new Set(["zemd", "dependabot[bot]"])'));
  assert.ok(detect.includes("pull.head.repo?.full_name !== repository"));
  assert.ok(detect.includes("pull.head.sha !== workflowRun.head_sha"));
  assert.ok(detect.includes("JSON.parse(source).devDependencies?.oxfmt"));
  assert.ok(detect.includes("before === after"));
  assert.doesNotMatch(detect, /actions\/checkout|RELEASE_BRANCHKEEPER/);

  assert.ok(usesAction(format, "actions/checkout"));
  assert.ok(format.includes("ref: ${{ needs.detect.outputs.head-sha }}"));
  assert.ok(format.includes("persist-credentials: false"));
  assert.ok(formatFiles.includes("run: pnpm format"));
  assert.ok(collect.includes('changedPaths("M")'));
  assert.ok(collect.includes("Formatting may only modify existing repository files"));
  assert.ok(usesAction(format, "actions/upload-artifact"));
  assert.doesNotMatch(format, /RELEASE_BRANCHKEEPER/);

  assert.ok(usesAction(commit, "actions/download-artifact"));
  assert.doesNotMatch(commit, /actions\/checkout/);
  assert.ok(validate.includes("payload.headSha !== expectedHeadSha"));
  assert.ok(validate.includes("payload.additions.length > 100"));
  assert.ok(
    commit.indexOf("Validate formatted files") <
      commit.indexOf("Create Release Branchkeeper token"),
  );
  assert.ok(usesAction(token, "actions/create-github-app-token"));
  assert.ok(token.includes("permission-contents: write"));
  assert.ok(token.includes("permission-pull-requests: read"));
  assert.ok(createCommit.includes("createCommitOnBranch(input: $input)"));
  assert.ok(createCommit.includes("expectedHeadOid"));
  assert.ok(createCommit.includes("fileChanges: { additions: payload.additions }"));
  assert.ok(createCommit.includes("chore: format with updated oxfmt"));
  assert.doesNotMatch(source, /\.changeset\//);
});

void test("the oxfmt detector requires an exact root dependency version change", async () => {
  const source = read(workflowsDir, WORKFLOW);
  const step = workflowStep(source, "Detect an oxfmt dependency update");
  const baseSha = "a".repeat(40);
  const headSha = "b".repeat(40);
  const manifestPath = "package.json";
  const manifest = (version: string): string =>
    JSON.stringify({ devDependencies: { oxfmt: version } });

  const detect = async ({
    before = "0.63.0",
    after = "0.64.0",
    author = "dependabot[bot]",
    baseRef = "main",
    headRef = "dependabot/npm_and_yarn/development-dependencies",
    headRepository = "zemd/js",
    manifestChanged = true,
    state = "open",
    workflowHeadSha = headSha,
  }: {
    before?: string;
    after?: string;
    author?: string;
    baseRef?: string;
    headRef?: string;
    headRepository?: string;
    manifestChanged?: boolean;
    state?: string;
    workflowHeadSha?: string;
  } = {}): Promise<string> => {
    const outputs = new Map<string, string>();

    await runWorkflowJavaScript(step, {
      Buffer,
      context: {
        payload: {
          workflow_run: {
            event: "pull_request",
            head_sha: workflowHeadSha,
            pull_requests: [{ number: 57 }],
          },
        },
        repo: { owner: "zemd", repo: "js" },
      },
      core: {
        info: () => undefined,
        notice: () => undefined,
        setOutput: (name: string, value: string) => outputs.set(name, value),
      },
      github: {
        paginate: () =>
          Promise.resolve(manifestChanged ? [{ filename: manifestPath, status: "modified" }] : []),
        rest: {
          pulls: {
            get: () =>
              Promise.resolve({
                data: {
                  base: { ref: baseRef, sha: baseSha },
                  head: {
                    ref: headRef,
                    repo: { full_name: headRepository },
                    sha: headSha,
                  },
                  number: 57,
                  state,
                  user: { login: author },
                },
              }),
            listFiles: () => Promise.resolve(),
          },
          repos: {
            getContent: ({ ref }: { ref: string }) =>
              Promise.resolve({
                data: {
                  content: Buffer.from(
                    ref === baseSha ? manifest(before) : manifest(after),
                  ).toString("base64"),
                  type: "file",
                },
              }),
          },
        },
      },
    });

    return outputs.get("required") ?? "";
  };

  assert.strictEqual(await detect(), "true");
  assert.strictEqual(await detect({ state: "closed" }), "false");
  assert.strictEqual(await detect({ baseRef: "develop" }), "false");
  assert.strictEqual(await detect({ headRepository: "untrusted/js" }), "false");
  assert.strictEqual(await detect({ headRef: "release/main" }), "false");
  assert.strictEqual(await detect({ after: "0.63.0" }), "false");
  assert.strictEqual(await detect({ manifestChanged: false }), "false");
  assert.strictEqual(await detect({ author: "someone-else" }), "false");
  assert.strictEqual(await detect({ workflowHeadSha: "c".repeat(40) }), "false");
});

void test("Branchkeeper commits only the formatted files", async () => {
  const source = read(workflowsDir, WORKFLOW);
  const step = workflowStep(source, "Commit formatted files");
  const baseSha = "a".repeat(40);
  const headSha = "b".repeat(40);
  const formattedAddition = {
    path: "packages/example/src/index.ts",
    contents: Buffer.from('export const value = "formatted";\n').toString("base64"),
  };
  const payload = JSON.stringify({ headSha, additions: [formattedAddition] });
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
        return Promise.resolve({ createCommitOnBranch: { commit: { oid: "c".repeat(40) } } });
      },
      rest: {
        pulls: {
          get: () =>
            Promise.resolve({
              data: {
                base: { ref: "main", sha: baseSha },
                head: {
                  ref: "dependabot/npm_and_yarn/development-dependencies",
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
          getContent: ({ path, ref }: { path: string; ref: string }) => {
            if (path === "package.json") {
              const version = ref === baseSha ? "0.63.0" : "0.64.0";
              return Promise.resolve({
                data: {
                  content: Buffer.from(
                    JSON.stringify({ devDependencies: { oxfmt: version } }),
                  ).toString("base64"),
                  type: "file",
                },
              });
            }
            assert.strictEqual(path, formattedAddition.path);
            assert.strictEqual(ref, headSha);
            return Promise.resolve({ data: { content: "", type: "file" } });
          },
        },
      },
    },
    process: {
      env: {
        EXPECTED_HEAD_SHA: headSha,
        PR_NUMBER: "57",
        VALIDATED_UPDATE_FILE: "/tmp/oxfmt-update-validated.json",
      },
    },
    require: (specifier: string) => {
      assert.strictEqual(specifier, "node:fs");
      return { readFileSync: () => payload };
    },
  });

  const normalizedMutationInput: unknown = JSON.parse(JSON.stringify(mutationInput));
  assert.deepStrictEqual(normalizedMutationInput, {
    branch: {
      repositoryNameWithOwner: "zemd/js",
      branchName: "dependabot/npm_and_yarn/development-dependencies",
    },
    expectedHeadOid: headSha,
    message: {
      headline: "chore: format with updated oxfmt",
    },
    fileChanges: {
      additions: [formattedAddition],
    },
  });
});

void test("Branchkeeper revalidates eligibility before writing formatted files", async () => {
  const source = read(workflowsDir, WORKFLOW);
  const step = workflowStep(source, "Commit formatted files");
  const headSha = "b".repeat(40);
  const payload = JSON.stringify({
    headSha,
    additions: [
      {
        path: "packages/example/src/index.ts",
        contents: Buffer.from("export {};\n").toString("base64"),
      },
    ],
  });

  for (const { author, headRef } of [
    { author: "someone-else", headRef: "feature/oxfmt-update" },
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
          VALIDATED_UPDATE_FILE: "/tmp/oxfmt-update-validated.json",
        },
      },
      require: () => ({ readFileSync: () => payload }),
    });

    assert.strictEqual(wrote, false, `${author} on ${headRef} must not receive a commit`);
  }
});
