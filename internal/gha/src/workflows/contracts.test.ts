import assert from "node:assert/strict";
import { test } from "node:test";

import {
  read,
  usesReferences,
  workflowExampleFiles,
  workflowStep,
  workflowsDir,
  yamlFiles,
} from "../testing/workflows.ts";

const MAX_JOB_TIMEOUT_MINUTES = 15;

void test("workflow filenames distinguish repository callers from shared workflows", () => {
  for (const file of [...yamlFiles(workflowsDir), ...workflowExampleFiles()]) {
    assert.match(
      file,
      /^(?:repo|shared)-[a-z0-9-]+\.ya?ml$/,
      `${file}: workflow filenames must start with repo- or shared-`,
    );
  }
});

void test("workflow examples mirror the reusable-workflow caller filenames", () => {
  const callers = yamlFiles(workflowsDir)
    .filter(
      (file) =>
        file.startsWith("repo-") &&
        read(workflowsDir, file).includes("uses: ./.github/workflows/shared-"),
    )
    .sort();

  assert.deepStrictEqual(workflowExampleFiles().sort(), callers);
});

void test("workflow step extraction does not cross whitespace-heavy sibling boundaries", () => {
  const source = [
    "      - name: Stage packages on npm",
    "        if: inputs.staged-publishing",
    ...Array.from({ length: 10_000 }, () => "        "),
    "      - name: Later step",
    "        run: pnpm stage publish -r --report-summary",
  ].join("\n");

  const step = workflowStep(source, "Stage packages on npm");
  assert.ok(!step.includes("Later step"));
  assert.ok(!step.includes("run:"));
});

void test("every action and workflow reference is pinned to a full commit SHA", () => {
  for (const file of yamlFiles(workflowsDir)) {
    for (const { reference, comment } of usesReferences(read(workflowsDir, file))) {
      // Same-repository calls resolve to the caller's own commit.
      if (reference.startsWith("./")) continue;

      assert.match(
        reference,
        /@[0-9a-f]{40}$/,
        `${file}: "${reference}" must be pinned to a commit SHA`,
      );
      assert.notStrictEqual(
        comment,
        undefined,
        `${file}: "${reference}" must carry a "# <version>" comment`,
      );
    }
  }
});

void test("every runner job starts Harden Runner in audit mode", () => {
  const hardenRunner =
    /^ {4}steps:\n {6}- name: Harden Runner\n {8}uses: step-security\/harden-runner@[^\s#]+(?: # .+)?\n {8}with:\n {10}egress-policy: audit$/gm;

  for (const file of yamlFiles(workflowsDir)) {
    const source = read(workflowsDir, file);
    const runnerJobs = [...source.matchAll(/^ {4}runs-on:/gm)].length;
    const hardenedJobs = [...source.matchAll(hardenRunner)].length;

    assert.strictEqual(
      hardenedJobs,
      runnerJobs,
      `${file}: Harden Runner must be the first step of every runner job`,
    );
  }
});

void test("shared workflows are callable and self-contained", () => {
  const shared = yamlFiles(workflowsDir).filter((file) => file.startsWith("shared-"));
  assert.ok(shared.length > 0);

  for (const file of shared) {
    const source = read(workflowsDir, file);
    assert.match(
      source,
      /^on:\n {2}workflow_call:$/m,
      `${file} must only trigger on workflow_call`,
    );
    // `env` declared by a caller is never propagated into a reusable workflow.
    assert.ok(!source.includes("${{ env."), `${file} must not read the caller's env context`);
  }
});

void test("callers delegate to the shared workflows", () => {
  const callers: Array<[string, string]> = [
    ["repo-benchmarks.yml", "shared-benchmarks.yml"],
    ["repo-ci.yml", "shared-ci.yml"],
    ["repo-codeql.yml", "shared-codeql.yml"],
    ["repo-scorecard.yml", "shared-scorecard.yml"],
    ["repo-zizmor.yml", "shared-zizmor.yml"],
    // npm trusted publishing validates the caller filename, so it is part of the contract.
    ["repo-release.yml", "shared-release.yml"],
  ];

  for (const [caller, shared] of callers) {
    assert.ok(
      read(workflowsDir, caller).includes(`uses: ./.github/workflows/${shared}`),
      `${caller} must call ${shared}`,
    );
  }
});

void test("the shared contract guard only inspects pull-request change intents", () => {
  const step = workflowStep(
    read(workflowsDir, "repo-ci.yml"),
    "Require a release intent when the shared contract changes",
  );

  assert.match(step, /git diff --name-only --diff-filter=AM -z "\$BASE_SHA\.\.\.\$HEAD_SHA" --/);
  assert.ok(step.includes("'.changeset/*.md'"));
  assert.ok(step.includes('scalar(line.slice(0, separator)) !== "@zemd/gha"'));
  assert.ok(step.includes("/^(?:major|minor|patch)$/"));
  assert.ok(step.includes('hasReleaseIntent(readFileSync(path, "utf8"))'));
  assert.doesNotMatch(step, /grep|\.includes\([^\n]*@zemd\/gha/);
});

void test("every runner job has a bounded timeout", () => {
  for (const file of yamlFiles(workflowsDir)) {
    const lines = read(workflowsDir, file).split("\n");

    for (const [lineIndex, line] of lines.entries()) {
      if (!/^ {4}runs-on:/.test(line)) continue;

      const precedingLines = lines.slice(0, lineIndex).reverse();
      const jobOffset = precedingLines.findIndex((candidate) =>
        /^ {2}[A-Za-z_][A-Za-z0-9_-]*:$/.test(candidate),
      );
      assert.ok(jobOffset >= 0, `${file}:${lineIndex + 1} must belong to a job`);

      const jobStart = lineIndex - jobOffset - 1;
      const nextJobOffset = lines
        .slice(jobStart + 1)
        .findIndex((candidate) => /^ {2}[A-Za-z_][A-Za-z0-9_-]*:$/.test(candidate));
      const jobEnd = nextJobOffset < 0 ? lines.length : jobStart + 1 + nextJobOffset;
      const job = lines.slice(jobStart, jobEnd).join("\n");
      const jobName = lines[jobStart]?.trim().replace(/:$/, "") ?? "unknown";
      const timeout = job.match(/^ {4}timeout-minutes: (\d+)$/m)?.[1];

      assert.notStrictEqual(timeout, undefined, `${file}:${jobName} must set timeout-minutes`);
      assert.ok(Number(timeout) > 0, `${file}:${jobName} timeout must be positive`);
      assert.ok(
        Number(timeout) <= MAX_JOB_TIMEOUT_MINUTES,
        `${file}:${jobName} timeout must not exceed ${MAX_JOB_TIMEOUT_MINUTES} minutes`,
      );
    }
  }
});

void test("shared workflows set the telemetry opt-out themselves", () => {
  for (const file of ["shared-benchmarks.yml", "shared-ci.yml", "shared-release.yml"]) {
    assert.match(
      read(workflowsDir, file),
      /^ {2}DO_NOT_TRACK: 1$/m,
      `${file} must set DO_NOT_TRACK`,
    );
  }
});
