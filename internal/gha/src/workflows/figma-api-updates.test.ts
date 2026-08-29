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

const WORKFLOW = "repo-pr-automation-figma-api-regeneration.yml";

void test("Figma spec updates run generation without exposing the commit credential", () => {
  const source = read(workflowsDir, WORKFLOW);
  const detect = workflowJob(source, "detect");
  const generate = workflowJob(source, "generate");
  const commit = workflowJob(source, "commit");
  const commands = workflowStep(source, "Regenerate and format the Figma API");
  const collect = workflowStep(source, "Collect generated package files");
  const validate = workflowStep(source, "Validate generated package files");
  const token = workflowStep(source, "Create Release Branchkeeper token");
  const createCommit = workflowStep(source, "Commit generated package files and changeset");

  assert.match(
    source,
    /^ {2}workflow_run:\n {4}workflows:\n {6}- CI\n {4}types:\n {6}- requested\n {6}- completed$/m,
  );
  assert.ok(source.includes("zizmor: ignore[dangerous-triggers]"));
  assert.doesNotMatch(source, /pull_request_target/);

  assert.ok(detect.includes('new Set(["zemd", "dependabot[bot]"])'));
  assert.ok(detect.includes("pull.head.repo?.full_name !== repository"));
  assert.ok(detect.includes("pull.head.sha !== workflowRun.head_sha"));
  assert.ok(detect.includes('const dependency = "@figma/rest-api-spec"'));
  assert.ok(detect.includes("before === after"));
  assert.doesNotMatch(detect, /actions\/checkout|RELEASE_BRANCHKEEPER/);

  assert.ok(usesAction(generate, "actions/checkout"));
  assert.ok(generate.includes("ref: ${{ needs.detect.outputs.head-sha }}"));
  assert.ok(generate.includes("persist-credentials: false"));
  assert.ok(commands.includes("pnpm --filter @zemd/figma-rest-api run generate-api"));
  assert.ok(commands.includes("pnpm run format"));
  assert.ok(collect.includes('changedPaths("AM")'));
  assert.ok(collect.includes('"http-clients/figma"'));
  assert.ok(usesAction(generate, "actions/upload-artifact"));
  assert.doesNotMatch(generate, /RELEASE_BRANCHKEEPER/);

  assert.ok(usesAction(commit, "actions/download-artifact"));
  assert.doesNotMatch(commit, /actions\/checkout/);
  assert.ok(validate.includes("payload.headSha !== expectedHeadSha"));
  assert.ok(validate.includes('addition.path.startsWith("http-clients/figma/")'));
  assert.ok(
    commit.indexOf("Validate generated package files") <
      commit.indexOf("Create Release Branchkeeper token"),
  );
  assert.ok(usesAction(token, "actions/create-github-app-token"));
  assert.ok(token.includes("permission-contents: write"));
  assert.ok(token.includes("permission-pull-requests: read"));
  assert.ok(createCommit.includes("createCommitOnBranch(input: $input)"));
  assert.ok(createCommit.includes("expectedHeadOid"));
  assert.ok(createCommit.includes('"@zemd/figma-rest-api": patch'));
  assert.ok(createCommit.includes(".changeset/figma-api-"));
  assert.ok(createCommit.includes("chore(figma): regenerate REST API client"));
});

void test("the Figma detector requires an exact dependency version change", async () => {
  const source = read(workflowsDir, WORKFLOW);
  const step = workflowStep(source, "Detect a Figma REST API spec update");
  const baseSha = "a".repeat(40);
  const headSha = "b".repeat(40);
  const manifestPath = "http-clients/figma/package.json";
  const manifest = (version: string): string =>
    JSON.stringify({ dependencies: { "@figma/rest-api-spec": version } });

  const detect = async ({
    before = "0.41.0",
    after = "0.42.0",
    author = "dependabot[bot]",
    baseRef = "main",
    headRef = "dependabot/npm_and_yarn/http-clients/figma/dependencies",
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
  assert.strictEqual(await detect({ after: "0.41.0" }), "false");
  assert.strictEqual(await detect({ manifestChanged: false }), "false");
  assert.strictEqual(await detect({ author: "someone-else" }), "false");
  assert.strictEqual(await detect({ workflowHeadSha: "c".repeat(40) }), "false");
});

void test("Branchkeeper atomically commits generated Figma files and release intent", async () => {
  const source = read(workflowsDir, WORKFLOW);
  const step = workflowStep(source, "Commit generated package files and changeset");
  const baseSha = "a".repeat(40);
  const headSha = "b".repeat(40);
  const generatedAddition = {
    path: "http-clients/figma/src/openapi.json",
    contents: Buffer.from('{"openapi":"3.0.0"}\n').toString("base64"),
  };
  const payload = JSON.stringify({ headSha, additions: [generatedAddition] });
  let existingChangeset: { path: string; contents: string } | undefined;
  let mutationInput: unknown;

  const globals = {
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
      paginate: () =>
        Promise.resolve(
          existingChangeset === undefined
            ? []
            : [{ filename: existingChangeset.path, status: "added" }],
        ),
      rest: {
        pulls: {
          get: () =>
            Promise.resolve({
              data: {
                base: { ref: "main", sha: baseSha },
                head: {
                  ref: "dependabot/npm_and_yarn/http-clients/figma/dependencies",
                  repo: { full_name: "zemd/js" },
                  sha: headSha,
                },
                number: 57,
                state: "open",
                user: { login: "dependabot[bot]" },
              },
            }),
          listFiles: () => Promise.resolve(),
        },
        repos: {
          getContent: ({ path, ref }: { path: string; ref: string }) => {
            if (path === "http-clients/figma/package.json") {
              const version = ref === baseSha ? "0.41.0" : "0.42.0";
              return Promise.resolve({
                data: {
                  content: Buffer.from(
                    JSON.stringify({ dependencies: { "@figma/rest-api-spec": version } }),
                  ).toString("base64"),
                  type: "file",
                },
              });
            }
            if (path === existingChangeset?.path) {
              return Promise.resolve({
                data: {
                  content: Buffer.from(existingChangeset.contents).toString("base64"),
                  type: "file",
                },
              });
            }
            return Promise.reject(Object.assign(new Error("not found"), { status: 404 }));
          },
        },
      },
    },
    process: {
      env: {
        EXPECTED_HEAD_SHA: headSha,
        PR_NUMBER: "57",
        VALIDATED_UPDATE_FILE: "/tmp/figma-api-update-validated.json",
      },
    },
    require: (specifier: string) => {
      assert.strictEqual(specifier, "node:fs");
      return { readFileSync: () => payload };
    },
  };

  await runWorkflowJavaScript(step, globals);

  const normalizedMutationInput: unknown = JSON.parse(JSON.stringify(mutationInput));
  assert.deepStrictEqual(normalizedMutationInput, {
    branch: {
      repositoryNameWithOwner: "zemd/js",
      branchName: "dependabot/npm_and_yarn/http-clients/figma/dependencies",
    },
    expectedHeadOid: headSha,
    message: {
      headline: "chore(figma): regenerate REST API client",
    },
    fileChanges: {
      additions: [
        generatedAddition,
        {
          path: ".changeset/figma-api-57.md",
          contents: Buffer.from(
            '---\n"@zemd/figma-rest-api": patch\n---\n\n' +
              "Regenerate the Figma REST API client from the updated API specification.\n",
          ).toString("base64"),
        },
      ],
    },
  });

  existingChangeset = {
    path: ".changeset/existing-figma-api.md",
    contents: '---\n"@zemd/figma-rest-api": "patch"\n---\n\nAlready has release intent.\n',
  };
  mutationInput = undefined;

  await runWorkflowJavaScript(step, globals);

  const normalizedExistingReleaseMutationInput: unknown = JSON.parse(JSON.stringify(mutationInput));
  assert.deepStrictEqual(normalizedExistingReleaseMutationInput, {
    branch: {
      repositoryNameWithOwner: "zemd/js",
      branchName: "dependabot/npm_and_yarn/http-clients/figma/dependencies",
    },
    expectedHeadOid: headSha,
    message: {
      headline: "chore(figma): regenerate REST API client",
    },
    fileChanges: {
      additions: [generatedAddition],
    },
  });
});
