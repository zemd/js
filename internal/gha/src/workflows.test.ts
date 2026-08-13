import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { test } from "node:test";

import { commands } from "./commands/index.ts";
import { planContractVersion } from "./contract-version.ts";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const workflowsDir = `${root}.github/workflows/`;
const examplesDir = `${root}.github/workflows-examples/`;
const scriptsDir = `${root}.github/scripts/`;

const BUNDLE = "gha.mjs";
const MAX_JOB_TIMEOUT_MINUTES = 15;

const yamlFiles = (directory: string): string[] =>
  readdirSync(directory).filter((file) => file.endsWith(".yml") || file.endsWith(".yaml"));

const workflowExampleFiles = (): string[] =>
  yamlFiles(examplesDir).filter((file) => file !== "dependabot.yml");

const read = (directory: string, file: string): string => readFileSync(directory + file, "utf8");

void test("workflow filenames distinguish repository callers from shared workflows", () => {
  for (const file of [...yamlFiles(workflowsDir), ...workflowExampleFiles()]) {
    assert.match(
      file,
      /^(?:repo|shared)-[a-z0-9-]+\.ya?ml$/,
      `${file}: workflow filenames must start with repo- or shared-`,
    );
  }
});

void test("workflow examples mirror the repository caller filenames", () => {
  const callers = yamlFiles(workflowsDir)
    .filter((file) => file.startsWith("repo-"))
    .sort();

  assert.deepStrictEqual(workflowExampleFiles().sort(), callers);
});

const dependabotUpdater = (source: string, ecosystem: string): string => {
  const marker = `  - package-ecosystem: "${ecosystem}"`;
  const start = source.indexOf(marker);
  if (start < 0) throw new Error(`Dependabot does not configure ${ecosystem}`);

  const end = source.indexOf("\n  - package-ecosystem:", start + marker.length);
  return source.slice(start, end < 0 ? source.length : end);
};

const yamlStringList = (source: string, key: string, indentation: number): string[] => {
  const keyIndent = " ".repeat(indentation);
  const itemIndent = " ".repeat(indentation + 2);
  const match = source.match(
    new RegExp(`^${keyIndent}${key}:\\n((?:^${itemIndent}- .+\\n?)*)`, "m"),
  );

  return (match?.[1] ?? "")
    .split("\n")
    .filter(Boolean)
    .map((line) => line.slice(indentation + 4).replace(/^["']|["']$/g, ""));
};

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

const usesAction = (source: string, action: string): boolean =>
  usesReferences(source).some(({ reference }) => reference.startsWith(`${action}@`));

const workflowStep = (source: string, name: string): string => {
  const lines = source.split("\n");
  const marker = `- name: ${name}`;
  const start = lines.findIndex((line) => line.trimStart() === marker);
  if (start < 0) throw new Error(`Workflow does not define the "${name}" step`);

  const firstLine = lines[start];
  if (firstLine === undefined) throw new Error(`Workflow does not define the "${name}" step`);

  const indentation = firstLine.length - firstLine.trimStart().length;
  let end = start + 1;

  while (end < lines.length) {
    const line = lines[end];
    if (line === undefined) break;

    const trimmed = line.trimStart();
    if (trimmed.length > 0 && line.length - trimmed.length <= indentation) break;
    end += 1;
  }

  return lines.slice(start, end).join("\n");
};

const workflowJob = (source: string, name: string): string => {
  const lines = source.split("\n");
  const marker = `  ${name}:`;
  const start = lines.findIndex((line) => line === marker);
  if (start < 0) throw new Error(`Workflow does not define the "${name}" job`);

  let end = start + 1;
  while (end < lines.length && !/^ {2}[A-Za-z_][A-Za-z0-9_-]*:$/.test(lines[end] ?? "")) {
    end += 1;
  }

  return lines.slice(start, end).join("\n");
};

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
  assert.ok(step.includes(`grep -lF '"@zemd/gha"' "\${changesets[@]}"`));
  assert.doesNotMatch(step, /grep[^\n]*\.changeset/);
});

void test("every native unit-test package exposes the fixed test-coverage script", () => {
  const manifests = [`${root}packages/`, `${root}http-clients/`, `${root}internal/`].flatMap(
    (directory) =>
      readdirSync(directory, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => {
          const path = `${directory}${entry.name}/package.json`;
          return {
            path,
            manifest: JSON.parse(readFileSync(path, "utf8")) as {
              name?: string;
              scripts?: Record<string, string>;
            },
          };
        }),
  );
  const tested = manifests.filter(({ manifest }) => manifest.scripts?.["test"]?.includes("--test"));
  assert.ok(tested.length > 0);

  for (const { path, manifest } of tested) {
    const coverage = manifest.scripts?.["test-coverage"];
    const name = manifest.name ?? path;
    assert.strictEqual(manifest.scripts?.["coverage"], undefined);
    assert.ok(coverage, `${name} must expose a test-coverage script`);
    assert.ok(
      coverage.includes("--experimental-test-coverage"),
      `${name} must use Node.js native coverage`,
    );
    assert.ok(coverage.includes("--test-reporter=lcov"), `${name} must emit LCOV`);
    assert.ok(
      coverage.includes("--test-reporter-destination=coverage.lcov"),
      `${name} must write coverage.lcov`,
    );
    assert.ok(
      coverage.includes("--test-coverage-exclude=src/**/*.test.ts"),
      `${name} must exclude test sources from its report`,
    );
  }
});

void test("shared workflows use fixed package script names", () => {
  const benchmarks = read(workflowsDir, "shared-benchmarks.yml");
  const source = read(workflowsDir, "shared-ci.yml");
  const release = read(workflowsDir, "shared-release.yml");
  const benchmarkCaller = read(workflowsDir, "repo-benchmarks.yml");
  const caller = read(workflowsDir, "repo-ci.yml");
  const benchmarkExample = read(examplesDir, "repo-benchmarks.yml");
  const example = read(examplesDir, "repo-ci.yml");
  const releaseExample = read(examplesDir, "repo-release.yml");
  const lint = workflowStep(source, "Lint");
  const format = workflowStep(source, "Check formatting");
  const typecheck = workflowStep(source, "Typecheck");
  const build = workflowStep(source, "Build");
  const runTests = workflowStep(source, "Run tests");
  const coverage = workflowStep(source, "Run tests with native coverage");
  const upload = workflowStep(source, "Upload native coverage reports");
  const publint = workflowStep(source, "Validate publishable packages");
  const browser = workflowStep(source, "Run browser tests");
  const runBenchmarks = workflowStep(benchmarks, "Run benchmarks");
  const releaseBuild = workflowStep(release, "Build");
  const releasePublint = workflowStep(release, "Validate publishable packages");
  const manifest = JSON.parse(readFileSync(`${root}package.json`, "utf8")) as {
    scripts: Record<string, string>;
  };

  for (const file of yamlFiles(workflowsDir).filter((candidate) =>
    candidate.startsWith("shared-"),
  )) {
    const workflow = read(workflowsDir, file);
    assert.doesNotMatch(workflow, /^ {6}[a-z0-9-]+-script:$/m);
    assert.doesNotMatch(workflow, /\binputs\.[a-z0-9-]+-script\b/);
  }

  for (const workflow of [benchmarkCaller, caller, benchmarkExample, example, releaseExample]) {
    assert.doesNotMatch(workflow, /^ {6}[a-z0-9-]+-script:/m);
  }

  for (const [step, script] of [
    [lint, "lint-check"],
    [format, "format-check"],
    [typecheck, "typecheck"],
    [build, "build"],
    [runTests, "test"],
    [coverage, "test-coverage"],
    [publint, "lint-publish"],
    [browser, "test-browser"],
    [runBenchmarks, "test-bench"],
    [releaseBuild, "build"],
    [releasePublint, "lint-publish"],
  ] as const) {
    assert.ok(step.includes(`run: pnpm run ${script}`));
    assert.ok(manifest.scripts[script], `root package.json must expose ${script}`);
  }

  assert.ok(runTests.includes("if: runner.os != 'Linux'"));
  assert.ok(coverage.includes("if: runner.os == 'Linux'"));
  assert.ok(coverage.includes("run: pnpm run test-coverage"));
  assert.ok(usesAction(upload, "actions/upload-artifact"));
  assert.ok(upload.includes("name: native-node-coverage-${{ matrix.os }}"));
  assert.ok(upload.includes('path: "**/coverage.lcov"'));
  assert.ok(upload.includes("if-no-files-found: error"));
  assert.ok(source.includes("if: inputs.playwright-filter != ''"));
  assert.ok(browser.includes("run: pnpm run test-browser"));
  assert.ok(caller.includes('playwright-filter: "@zemd/std-modules"'));
  assert.strictEqual(manifest.scripts["coverage"], undefined);
  assert.strictEqual(manifest.scripts["test-coverage"], "turbo run test-coverage");
});

void test("shared benchmarks report namespaced BMF results to Bencher", () => {
  const source = read(workflowsDir, "shared-benchmarks.yml");
  const caller = read(workflowsDir, "repo-benchmarks.yml");
  const example = read(examplesDir, "repo-benchmarks.yml");
  const benchmarkJob = workflowJob(source, "benchmarks");
  const publishJob = workflowJob(source, "publish");
  const setup = workflowStep(source, "Setup Bencher");
  const runBenchmarks = workflowStep(source, "Run benchmarks");
  const combine = workflowStep(source, "Combine benchmark results");
  const upload = workflowStep(source, "Upload benchmark results");
  const download = workflowStep(source, "Download benchmark results");
  const validate = workflowStep(source, "Validate benchmark results");
  const track = workflowStep(source, "Track benchmarks with Bencher");

  assert.match(source, /project:\n(?: {8}.*\n){2} {8}required: true/);
  assert.match(source, /BENCHER_API_KEY:\n(?: {8}.*\n) {8}required: true/);
  assert.match(source, /error-on-alert:\n(?: {8}.*\n){2} {8}default: false/);
  assert.ok(usesAction(setup, "bencherdev/bencher"));
  assert.match(setup, /^ {10}version: "\d+\.\d+\.\d+"$/m);

  assert.ok(runBenchmarks.includes("BENCHER_OUTPUT_DIR: ${{ runner.temp }}/bencher-results"));
  assert.ok(runBenchmarks.includes("run: pnpm run test-bench"));
  assert.ok(combine.includes("test-bench did not write any Bencher JSON files"));
  assert.ok(combine.includes("duplicate Bencher benchmark"));
  assert.ok(combine.includes("Object.fromEntries(entries)"));
  assert.ok(usesAction(upload, "actions/upload-artifact"));
  assert.ok(upload.includes("path: ${{ runner.temp }}/bencher-results.json"));
  assert.ok(upload.includes("if-no-files-found: error"));
  assert.ok(upload.includes("retention-days: 1"));

  assert.ok(publishJob.includes("needs: benchmarks"));
  assert.ok(usesAction(download, "actions/download-artifact"));
  assert.ok(download.includes("path: ${{ runner.temp }}/bencher-artifact"));
  assert.ok(validate.includes("benchmark artifact must contain only"));
  assert.ok(validate.includes("stats.size > maxBytes"));
  assert.ok(validate.includes("metricCount > 10_000"));
  assert.ok(validate.includes('Object.hasOwn(metric, "value")'));
  assert.ok(validate.includes("Number.isFinite(value)"));
  assert.ok(validate.includes("Object.create(null)"));

  assert.doesNotMatch(benchmarkJob, /\$\{\{ secrets\./);
  assert.doesNotMatch(benchmarkJob, /github\.token/);
  assert.doesNotMatch(benchmarkJob, /checks: write|pull-requests: write/);
  assert.doesNotMatch(benchmarkJob, /bencherdev\/bencher/);
  assert.doesNotMatch(publishJob, /actions\/checkout|pnpm install|pnpm run test-bench/);
  assert.ok(publishJob.includes("BENCHER_API_KEY: ${{ secrets.BENCHER_API_KEY }}"));
  assert.ok(
    publishJob.indexOf("Validate benchmark results") < publishJob.indexOf("BENCHER_API_KEY"),
  );

  for (const option of [
    '--project "$BENCHER_PROJECT"',
    '--branch "$BENCHER_BRANCH"',
    '--hash "$BENCHER_HASH"',
    "--testbed ubuntu-latest",
    "--adapter json",
    '--file "$BENCHER_RESULTS_FILE"',
    '--github-actions "$GITHUB_TOKEN"',
    "--ci-id benchmarks",
    '--start-point "$BENCHER_START_POINT"',
    '--start-point-hash "$BENCHER_START_POINT_HASH"',
    "--start-point-clone-thresholds",
    "--start-point-reset",
    "--error-on-alert",
  ]) {
    assert.ok(track.includes(option), `Bencher invocation must include ${option}`);
  }

  assert.strictEqual(
    source.match(
      /^ {4}if: github\.event_name != 'pull_request' \|\| github\.event\.pull_request\.head\.repo\.full_name == github\.repository$/gm,
    )?.length,
    2,
    "both benchmark jobs must reject fork pull requests",
  );
  for (const workflow of [caller, example]) {
    assert.ok(workflow.includes("vars.BENCHER_PROJECT != ''"));
    assert.ok(
      workflow.includes("github.event.pull_request.head.repo.full_name == github.repository"),
    );
    assert.ok(workflow.includes("project: ${{ vars.BENCHER_PROJECT }}"));
    assert.ok(workflow.includes("BENCHER_API_KEY: ${{ secrets.BENCHER_API_KEY }}"));
    assert.match(workflow, /^ {6}checks: write # .+$/m);
    assert.match(workflow, /^ {6}pull-requests: write # .+$/m);
  }
});

void test("shared workflow platform and release conventions are fixed", () => {
  const sharedFiles = yamlFiles(workflowsDir).filter((file) => file.startsWith("shared-"));
  const shared = sharedFiles.map((file) => read(workflowsDir, file));
  const examples = [read(examplesDir, "repo-ci.yml"), read(examplesDir, "repo-release.yml")];
  const removedInputs = [
    "node-version",
    "base-branch",
    "release-branch",
    "release-title",
    "registry-url",
  ];

  for (const input of removedInputs) {
    for (const workflow of shared) {
      assert.doesNotMatch(workflow, new RegExp(`^ {6}${input}:$`, "m"));
      assert.doesNotMatch(workflow, new RegExp(`\\binputs\\.${input}(?![a-z0-9-])`));
    }
    for (const example of examples) assert.ok(!example.includes(`${input}:`));
  }

  const setupNodeReferences = shared.reduce(
    (count, workflow) => count + [...workflow.matchAll(/^ {8}uses: actions\/setup-node@/gm)].length,
    0,
  );
  const fixedNodeVersions = shared.reduce(
    (count, workflow) => count + [...workflow.matchAll(/^ {10}node-version: "lts\/\*"$/gm)].length,
    0,
  );
  assert.ok(setupNodeReferences > 0);
  assert.strictEqual(fixedNodeVersions, setupNodeReferences);

  const releasePr = workflowStep(
    read(workflowsDir, "shared-release.yml"),
    "Open release pull request",
  );
  assert.match(releasePr, /^ {10}RELEASE_BRANCH: release\/main$/m);
  assert.match(releasePr, /^ {10}RELEASE_TITLE: "chore\(release\): version packages"$/m);
  assert.match(releasePr, /^ {10}BASE_BRANCH: main$/m);

  const ci = read(workflowsDir, "shared-ci.yml");
  const ciExample = read(examplesDir, "repo-ci.yml");
  assert.doesNotMatch(ci, /^ {6}dependency-review:$/m);
  assert.doesNotMatch(ci, /\binputs\.dependency-review(?!-)/);
  assert.match(ci, /^ {4}if: github\.event_name == 'pull_request'$/m);
  assert.match(ci, /dependency-review-severity:\n(?: {8}.*\n){2} {8}default: "moderate"/);
  assert.match(
    ci,
    /dependency-review-scopes:\n(?: {8}.*\n){2} {8}default: "runtime, development, unknown"/,
  );
  assert.ok(!ciExample.includes("dependency-review: true"));
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

void test("the release tooling is checked out from the pinned shared revision", () => {
  const source = read(workflowsDir, "shared-release.yml");
  const caller = read(workflowsDir, "repo-release.yml");
  const example = read(examplesDir, "repo-release.yml");

  // Privileged jobs do not check out caller code, so every job gets the CLI
  // from an explicitly configured shared-tooling checkout.
  assert.match(source, /shared-tooling-repository:\n(?: {8}.*\n){2} {8}required: true/);
  assert.match(source, /shared-tooling-ref:\n(?: {8}.*\n){2} {8}required: true/);
  assert.match(source, /repository: \$\{\{ inputs\.shared-tooling-repository \}\}/);
  assert.match(source, /ref: \$\{\{ inputs\.shared-tooling-ref \}\}/);
  assert.ok(!source.includes("job.workflow_"));
  assert.match(caller, /shared-tooling-repository: \$\{\{ github\.repository \}\}/);
  assert.match(caller, /shared-tooling-ref: \$\{\{ github\.sha \}\}/);
  assert.match(example, /shared-tooling-repository: zemd\/js/);
  assert.match(example, /shared-tooling-ref: __SHA__/);
  assert.match(source, /path: \.shared-ci/);
  assert.match(source, /echo "\/\.shared-ci\/" >> \.git\/info\/exclude/);
  assert.ok(source.includes(`SHARED_CLI: .shared-ci/.github/scripts/${BUNDLE}`));
});

void test("isolates caller code from every credentialed release job", () => {
  const source = read(workflowsDir, "shared-release.yml");
  const version = workflowJob(source, "version");
  const releasePr = workflowJob(source, "release-pr");
  const packageJob = workflowJob(source, "package");
  const publish = workflowJob(source, "publish");
  const githubRelease = workflowJob(source, "github-release");

  for (const job of [version, packageJob]) {
    assert.match(job, /^ {6}contents: read$/m);
    assert.doesNotMatch(job, /contents: write|pull-requests: write|id-token: write/);
    assert.doesNotMatch(job, /\$\{\{ secrets\.|github\.token/);
  }

  for (const job of [releasePr, publish, githubRelease]) {
    assert.doesNotMatch(job, /- name: Checkout Repo/);
    assert.doesNotMatch(job, /pnpm install|pnpm run build|pnpm run lint-publish/);
    assert.match(job, /- name: Checkout shared tooling/);
  }

  assert.match(releasePr, /^ {6}contents: read #/m);
  assert.doesNotMatch(releasePr, /^ {6}(?:contents|pull-requests): write/m);
  assert.doesNotMatch(releasePr, /^ {6}id-token: write/m);
  assert.ok(releasePr.includes("Download release pull request artifact"));
  assert.ok(releasePr.includes('node "${SHARED_CLI}" signed-commit'));
  assert.ok(releasePr.includes('"$GITHUB_SHA"'));

  assert.match(publish, /^ {4}environment: npm-production$/m);
  assert.match(publish, /^ {6}id-token: write # npm trusted publishing \(OIDC\)$/m);
  assert.doesNotMatch(publish, /contents: write|pull-requests: write/);
  assert.ok(publish.includes("Download package artifact"));
  assert.ok(publish.includes("Validate package artifact"));

  assert.match(githubRelease, /^ {6}contents: read #/m);
  assert.doesNotMatch(githubRelease, /^ {6}(?:contents|pull-requests): write/m);
  assert.doesNotMatch(githubRelease, /^ {6}id-token: write/m);
  assert.ok(githubRelease.includes("Download package artifact"));
  assert.ok(githubRelease.includes("Download publication records"));
  assert.ok(githubRelease.includes("Validate package artifact"));
});

void test("uses separate repository-scoped GitHub Apps for release writes", () => {
  const source = read(workflowsDir, "shared-release.yml");
  const caller = read(workflowsDir, "repo-release.yml");
  const example = read(examplesDir, "repo-release.yml");
  const releasePr = workflowJob(source, "release-pr");
  const githubRelease = workflowJob(source, "github-release");
  const sharedWorkflows = workflowJob(caller, "shared-workflows");
  const branchkeeperToken = workflowStep(source, "Create Release Branchkeeper token");
  const publisherToken = workflowStep(source, "Create Release Publisher token");
  const localPublisherToken = workflowStep(caller, "Create Release Publisher token");
  const openReleasePr = workflowStep(source, "Open release pull request");
  const createRelease = workflowStep(source, "Tag packages and create GitHub release");
  const createSharedRelease = workflowStep(caller, "Tag and release the shared workflows");

  for (const input of ["release-branchkeeper-client-id", "release-publisher-client-id"]) {
    assert.match(source, new RegExp(`${input}:\\n(?: {8}.*\\n){2} {8}required: true`));
  }
  for (const secret of ["RELEASE_BRANCHKEEPER_PRIVATE_KEY", "RELEASE_PUBLISHER_PRIVATE_KEY"]) {
    assert.match(source, new RegExp(`${secret}:\\n(?: {8}.*\\n) {8}required: true`));
  }

  for (const tokenStep of [branchkeeperToken, publisherToken, localPublisherToken]) {
    assert.ok(usesAction(tokenStep, "actions/create-github-app-token"));
    assert.ok(tokenStep.includes("owner: ${{ github.repository_owner }}"));
    assert.ok(tokenStep.includes("repositories: ${{ github.repository }}"));
    assert.ok(tokenStep.includes("permission-contents: write"));
  }

  assert.ok(branchkeeperToken.includes("client-id: ${{ inputs.release-branchkeeper-client-id }}"));
  assert.ok(
    branchkeeperToken.includes("private-key: ${{ secrets.RELEASE_BRANCHKEEPER_PRIVATE_KEY }}"),
  );
  assert.ok(branchkeeperToken.includes("permission-pull-requests: write"));
  assert.doesNotMatch(branchkeeperToken, /PUBLISHER|release-publisher/);

  assert.ok(publisherToken.includes("client-id: ${{ inputs.release-publisher-client-id }}"));
  assert.ok(publisherToken.includes("private-key: ${{ secrets.RELEASE_PUBLISHER_PRIVATE_KEY }}"));
  assert.doesNotMatch(publisherToken, /permission-pull-requests|BRANCHKEEPER|branchkeeper/);
  assert.ok(localPublisherToken.includes("vars.RELEASE_PUBLISHER_CLIENT_ID"));
  assert.ok(localPublisherToken.includes("secrets.RELEASE_PUBLISHER_PRIVATE_KEY"));

  assert.ok(
    openReleasePr.includes("GH_TOKEN: ${{ steps.release-branchkeeper-token.outputs.token }}"),
  );
  assert.ok(
    openReleasePr.includes("GITHUB_TOKEN: ${{ steps.release-branchkeeper-token.outputs.token }}"),
  );
  assert.ok(
    createRelease.includes("GITHUB_TOKEN: ${{ steps.release-publisher-token.outputs.token }}"),
  );
  assert.ok(
    createSharedRelease.includes(
      "GITHUB_TOKEN: ${{ steps.release-publisher-token.outputs.token }}",
    ),
  );
  for (const writeStep of [openReleasePr, createRelease, createSharedRelease]) {
    assert.doesNotMatch(writeStep, /github\.token/);
  }

  assert.ok(
    releasePr.indexOf("Download release pull request artifact") <
      releasePr.indexOf("Create Release Branchkeeper token"),
  );
  assert.ok(
    githubRelease.indexOf("Validate package artifact") <
      githubRelease.indexOf("Create Release Publisher token"),
  );
  assert.match(sharedWorkflows, /^ {6}contents: read #/m);
  assert.doesNotMatch(sharedWorkflows, /^ {6}contents: write/m);
  assert.doesNotMatch(sharedWorkflows, /github\.token|RELEASE_BRANCHKEEPER/);

  for (const workflow of [caller, example]) {
    const releaseCall = workflowJob(workflow, "release");
    assert.match(releaseCall, /^ {6}contents: read #/m);
    assert.match(releaseCall, /^ {6}id-token: write # npm trusted publishing \(OIDC\)$/m);
    assert.doesNotMatch(releaseCall, /^ {6}(?:contents|pull-requests): write/m);
    assert.ok(
      releaseCall.includes(
        "release-branchkeeper-client-id: ${{ vars.RELEASE_BRANCHKEEPER_CLIENT_ID }}",
      ),
    );
    assert.ok(
      releaseCall.includes("release-publisher-client-id: ${{ vars.RELEASE_PUBLISHER_CLIENT_ID }}"),
    );
    assert.ok(
      releaseCall.includes(
        "RELEASE_BRANCHKEEPER_PRIVATE_KEY: ${{ secrets.RELEASE_BRANCHKEEPER_PRIVATE_KEY }}",
      ),
    );
    assert.ok(
      releaseCall.includes(
        "RELEASE_PUBLISHER_PRIVATE_KEY: ${{ secrets.RELEASE_PUBLISHER_PRIVATE_KEY }}",
      ),
    );
  }
});

void test("publishes only validated tarballs without a recurring npm token", () => {
  const source = read(workflowsDir, "shared-release.yml");
  const example = read(examplesDir, "repo-release.yml");
  const publishingModeStep = workflowStep(source, "Select npm publishing mode");
  const rejectFirstReleaseStep = workflowStep(source, "Reject first releases");
  const stagedPublishingStep = workflowStep(source, "Stage packages on npm");
  const directPublishingStep = workflowStep(source, "Publish packages to npm directly");

  assert.match(source, /id-token: write # npm trusted publishing \(OIDC\)/);
  assert.doesNotMatch(source, /^ {6}registry-url:$/m);
  assert.ok(!source.includes("inputs.registry-url"));
  assert.match(source, /^ {10}registry-url: "https:\/\/registry\.npmjs\.org"$/m);
  assert.ok(publishingModeStep.includes('REGISTRY_URL: "https://registry.npmjs.org"'));
  assert.ok(!example.includes("registry-url"));
  assert.match(source, /staged-publishing:\n(?: {8}.*\n){2} {8}default: true/);
  assert.match(publishingModeStep, /^ {8}id: publishing$/m);
  assert.ok(publishingModeStep.includes("GITHUB_TOKEN: ${{ github.token }}"));
  assert.ok(publishingModeStep.includes('node "${SHARED_CLI}" npm-publishing-mode'));
  assert.ok(publishingModeStep.includes('"${RUNNER_TEMP}/first-releases.txt"'));
  assert.ok(publishingModeStep.includes('"${RUNNER_TEMP}/direct-packages.txt"'));
  assert.ok(
    publishingModeStep.includes('"${RUNNER_TEMP}/staged-packages.txt" >> "$GITHUB_OUTPUT"'),
  );
  assert.match(
    rejectFirstReleaseStep,
    /^ {8}if: steps\.publishing\.outputs\.first_release == 'true'$/m,
  );
  assert.ok(rejectFirstReleaseStep.includes("never accepts a long-lived npm token"));
  assert.match(stagedPublishingStep, /^ {8}if: steps\.publishing\.outputs\.stage == 'true'$/m);
  assert.ok(stagedPublishingStep.includes('node "${SHARED_CLI}" package-artifact tarball'));
  assert.ok(stagedPublishingStep.includes('pnpm stage publish "$tarball"'));
  assert.ok(stagedPublishingStep.includes('--registry "https://registry.npmjs.org"'));
  assert.ok(!stagedPublishingStep.includes("NPM_TOKEN"));
  assert.ok(!stagedPublishingStep.includes("NODE_AUTH_TOKEN"));
  assert.match(
    directPublishingStep,
    /^ {8}if: steps\.publishing\.outputs\.direct == 'true' && steps\.publishing\.outputs\.first_release == 'false'$/m,
  );
  assert.ok(directPublishingStep.includes('node "${SHARED_CLI}" package-artifact tarball'));
  assert.ok(directPublishingStep.includes('pnpm publish "$tarball"'));
  assert.ok(directPublishingStep.includes("--ignore-scripts"));
  assert.ok(directPublishingStep.includes('--registry "https://registry.npmjs.org"'));
  assert.doesNotMatch(source, /NPM_TOKEN|NODE_AUTH_TOKEN/);
  assert.deepStrictEqual(
    [...source.matchAll(/\$\{\{ secrets\.([A-Z_]+) \}\}/g)]
      .map((match) => match[1])
      .sort((left, right) => left.localeCompare(right)),
    ["RELEASE_BRANCHKEEPER_PRIVATE_KEY", "RELEASE_PUBLISHER_PRIVATE_KEY"],
  );
  assert.strictEqual(source.match(/^ {10}package-manager-cache: false$/gm)?.length, 4);
  assert.doesNotMatch(source, /^ {10}cache: "pnpm"$/m);
  assert.ok(source.includes('"${RUNNER_TEMP}/publication/published-summary.json"'));
  assert.ok(source.includes('"${RUNNER_TEMP}/publication/staged-summary.json"'));
  assert.ok(example.includes("# staged-publishing: true"));
  assert.doesNotMatch(example, /NPM_TOKEN|NODE_AUTH_TOKEN/);
  assert.deepStrictEqual(
    [...example.matchAll(/\$\{\{ secrets\.([A-Z_]+) \}\}/g)]
      .map((match) => match[1])
      .sort((left, right) => left.localeCompare(right)),
    ["RELEASE_BRANCHKEEPER_PRIVATE_KEY", "RELEASE_PUBLISHER_PRIVATE_KEY"],
  );
});

void test("can advance a private release-contract version before pnpm consumes its intents", () => {
  const source = read(workflowsDir, "shared-release.yml");
  const caller = read(workflowsDir, "repo-release.yml");
  const example = read(examplesDir, "repo-release.yml");

  assert.match(source, /contract-version-package:\n(?: {8}.*\n){2} {8}default: ""/);
  assert.ok(caller.includes("contract-version-package: internal/gha/package.json"));
  assert.ok(example.includes('# contract-version-package: ""'));
  assert.ok(source.includes("CONTRACT_VERSION_PACKAGE: ${{ inputs.contract-version-package }}"));
  assert.ok(source.includes('node "${SHARED_CLI}" contract-version prepare'));
  assert.ok(source.includes("pnpm version -r --json --no-git-checks"));
  assert.ok(source.includes('node "${SHARED_CLI}" contract-version finalize'));

  const toolingCheckout = source.indexOf("- name: Checkout shared tooling");
  const prepare = source.indexOf("contract-version prepare");
  const version = source.indexOf("pnpm version -r --json");
  const finalize = source.indexOf("contract-version finalize");
  assert.ok(toolingCheckout > -1);
  assert.ok(toolingCheckout < prepare);
  assert.ok(prepare < version);
  assert.ok(version < finalize);
});

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
      new RegExp(`^${pattern.replaceAll(".", "\\.").replace("*", ".*")}$`, "m"),
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
        /^zemd\/js\/\.github\/workflows\/shared-[a-z]+\.yml@__SHA__$/,
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

void test("the release workflow reads the contract version from the package manifest", () => {
  assert.ok(
    read(workflowsDir, "repo-release.yml").includes(
      "gha.mjs shared-workflows-release internal/gha/package.json .github/workflows",
    ),
  );
});

void test("the contract version is plain semver", () => {
  const manifest = JSON.parse(readFileSync(`${root}internal/gha/package.json`, "utf8")) as {
    version: string;
    private: boolean;
  };

  assert.match(manifest.version, /^\d+\.\d+\.\d+$/);
  // A published package would drag the workflow contract into the npm release.
  assert.strictEqual(manifest.private, true);
});
