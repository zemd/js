import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";

import {
  examplesDir,
  read,
  root,
  usesAction,
  workflowJob,
  workflowStep,
  workflowsDir,
  yamlFiles,
} from "../testing/workflows.ts";

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
