import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";

import { commands } from "./commands";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const workflowsDir = `${root}.github/workflows/`;
const examplesDir = `${root}.github/workflows-examples/`;
const scriptsDir = `${root}.github/scripts/`;

const BUNDLE = "gha.mjs";
const MAX_JOB_TIMEOUT_MINUTES = 15;

const yamlFiles = (directory: string): string[] =>
  readdirSync(directory).filter((file) => file.endsWith(".yml"));

const read = (directory: string, file: string): string => readFileSync(directory + file, "utf8");

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

test("workflow step extraction does not cross whitespace-heavy sibling boundaries", () => {
  const source = [
    "      - name: Stage packages on npm",
    "        if: inputs.staged-publishing",
    ...Array.from({ length: 10_000 }, () => "        "),
    "      - name: Later step",
    "        run: pnpm stage publish -r --report-summary",
  ].join("\n");

  const step = workflowStep(source, "Stage packages on npm");
  expect(step).not.toContain("Later step");
  expect(step).not.toContain("run:");
});

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
    ["zizmor.yml", "shared-zizmor.yml"],
    // npm trusted publishing validates the caller filename, so it is part of the contract.
    ["release.yml", "shared-release.yml"],
  ];

  for (const [caller, shared] of callers) {
    expect(read(workflowsDir, caller), `${caller} must call ${shared}`).toContain(
      `uses: ./.github/workflows/${shared}`,
    );
  }
});

test("every runner job has a bounded timeout", () => {
  for (const file of yamlFiles(workflowsDir)) {
    const lines = read(workflowsDir, file).split("\n");

    for (const [lineIndex, line] of lines.entries()) {
      if (!/^ {4}runs-on:/.test(line)) continue;

      const precedingLines = lines.slice(0, lineIndex).reverse();
      const jobOffset = precedingLines.findIndex((candidate) =>
        /^ {2}[A-Za-z_][A-Za-z0-9_-]*:$/.test(candidate),
      );
      expect(jobOffset, `${file}:${lineIndex + 1} must belong to a job`).toBeGreaterThanOrEqual(0);

      const jobStart = lineIndex - jobOffset - 1;
      const nextJobOffset = lines
        .slice(jobStart + 1)
        .findIndex((candidate) => /^ {2}[A-Za-z_][A-Za-z0-9_-]*:$/.test(candidate));
      const jobEnd = nextJobOffset < 0 ? lines.length : jobStart + 1 + nextJobOffset;
      const job = lines.slice(jobStart, jobEnd).join("\n");
      const jobName = lines[jobStart]?.trim().replace(/:$/, "") ?? "unknown";
      const timeout = job.match(/^ {4}timeout-minutes: (\d+)$/m)?.[1];

      expect(timeout, `${file}:${jobName} must set timeout-minutes`).toBeDefined();
      expect(Number(timeout), `${file}:${jobName} timeout must be positive`).toBeGreaterThan(0);
      expect(
        Number(timeout),
        `${file}:${jobName} timeout must not exceed ${MAX_JOB_TIMEOUT_MINUTES} minutes`,
      ).toBeLessThanOrEqual(MAX_JOB_TIMEOUT_MINUTES);
    }
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
  const caller = read(workflowsDir, "release.yml");
  const example = read(examplesDir, "release.yml");

  // `actions/checkout` pulls the *caller* repository, so the CLI this workflow
  // runs has to come from an explicitly configured second checkout.
  expect(source).toMatch(/shared-tooling-repository:\n(?: {8}.*\n){2} {8}required: true/);
  expect(source).toMatch(/shared-tooling-ref:\n(?: {8}.*\n){2} {8}required: true/);
  expect(source).toMatch(/repository: \$\{\{ inputs\.shared-tooling-repository \}\}/);
  expect(source).toMatch(/ref: \$\{\{ inputs\.shared-tooling-ref \}\}/);
  expect(source).not.toContain("job.workflow_");
  expect(caller).toMatch(/shared-tooling-repository: \$\{\{ github\.repository \}\}/);
  expect(caller).toMatch(/shared-tooling-ref: \$\{\{ github\.sha \}\}/);
  expect(example).toMatch(/shared-tooling-repository: zemd\/js/);
  expect(example).toMatch(/shared-tooling-ref: __SHA__/);
  expect(source).toMatch(/path: \.shared-ci/);
  expect(source).toMatch(/echo "\/\.shared-ci\/" >> \.git\/info\/exclude/);
  expect(source).toContain(`SHARED_CLI: .shared-ci/.github/scripts/${BUNDLE}`);
});

test("keeps tokens out of staging and uses direct publishing for first releases", () => {
  const source = read(workflowsDir, "shared-release.yml");
  const example = read(examplesDir, "release.yml");
  const publishingModeStep = workflowStep(source, "Select npm publishing mode");
  const stagedPublishingStep = workflowStep(source, "Stage packages on npm");
  const directPublishingStep = workflowStep(source, "Publish packages to npm directly");

  expect(source).toMatch(/id-token: write # npm trusted publishing \(OIDC\)/);
  expect(source).toMatch(/default: "https:\/\/registry\.npmjs\.org"/);
  expect(source).toMatch(/registry-url: \$\{\{ inputs\.registry-url \}\}/);
  expect(source).toMatch(/staged-publishing:\n(?: {8}.*\n){2} {8}default: true/);
  expect(publishingModeStep).toMatch(/^ {8}id: publishing$/m);
  expect(publishingModeStep).toContain("GITHUB_TOKEN: ${{ github.token }}");
  expect(publishingModeStep).toContain('node "${SHARED_CLI}" npm-publishing-mode');
  expect(publishingModeStep).toContain('"${RUNNER_TEMP}/first-releases.txt"');
  expect(publishingModeStep).toContain('"${RUNNER_TEMP}/direct-packages.txt"');
  expect(publishingModeStep).toContain('"${RUNNER_TEMP}/staged-packages.txt" >> "$GITHUB_OUTPUT"');
  expect(stagedPublishingStep).toMatch(/^ {8}if: steps\.publishing\.outputs\.stage == 'true'$/m);
  expect(stagedPublishingStep).toContain(
    'pnpm stage publish -r "${filters[@]}" --access public --no-git-checks --report-summary',
  );
  expect(stagedPublishingStep).toContain(
    "STAGED_PACKAGES_FILE: ${{ runner.temp }}/staged-packages.txt",
  );
  expect(stagedPublishingStep).toContain('filters+=("--filter=$package")');
  expect(stagedPublishingStep).not.toContain("NPM_TOKEN");
  expect(stagedPublishingStep).not.toContain("NODE_AUTH_TOKEN");
  expect(directPublishingStep).toMatch(/^ {8}if: steps\.publishing\.outputs\.direct == 'true'$/m);
  expect(directPublishingStep).toContain(
    "FIRST_RELEASE: ${{ steps.publishing.outputs.first_release }}",
  );
  expect(directPublishingStep).toContain(
    "DIRECT_PACKAGES_FILE: ${{ runner.temp }}/direct-packages.txt",
  );
  expect(directPublishingStep).toContain('mapfile -t packages < "$DIRECT_PACKAGES_FILE"');
  expect(directPublishingStep).toContain('filters+=("--filter=$package")');
  expect(directPublishingStep).not.toContain("DIRECT_ALL");
  expect(directPublishingStep).toContain("NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}");
  expect(directPublishingStep).toContain(
    'pnpm publish -r "${filters[@]}" --access public --no-git-checks --report-summary',
  );
  expect(source.match(/NODE_AUTH_TOKEN: \$\{\{ secrets\.NPM_TOKEN \}\}/g)).toHaveLength(1);
  expect(source).toMatch(/NPM_TOKEN:\n(?: {8}.*\n) {8}required: false/);
  expect(source).toContain('"${RUNNER_TEMP}/published-summary.json"');
  expect(source).toContain('"${RUNNER_TEMP}/staged-summary.json"');
  expect(example).toContain("# staged-publishing: true");
  expect(example).toContain("NPM_TOKEN: ${{ secrets.NPM_TOKEN }}");
});

test("can advance a private release-contract version before pnpm consumes its intents", () => {
  const source = read(workflowsDir, "shared-release.yml");
  const caller = read(workflowsDir, "release.yml");
  const example = read(examplesDir, "release.yml");

  expect(source).toMatch(/contract-version-package:\n(?: {8}.*\n){2} {8}default: ""/);
  expect(caller).toContain("contract-version-package: internal/gha/package.json");
  expect(example).toContain('# contract-version-package: ""');
  expect(source).toContain("CONTRACT_VERSION_PACKAGE: ${{ inputs.contract-version-package }}");
  expect(source).toContain('node "${SHARED_CLI}" contract-version prepare');
  expect(source).toContain("pnpm version -r --json --no-git-checks");
  expect(source).toContain('node "${SHARED_CLI}" contract-version finalize');

  const toolingCheckout = source.indexOf("- name: Checkout shared tooling");
  const prepare = source.indexOf("contract-version prepare");
  const version = source.indexOf("pnpm version -r --json");
  const finalize = source.indexOf("contract-version finalize");
  expect(toolingCheckout).toBeGreaterThan(-1);
  expect(toolingCheckout).toBeLessThan(prepare);
  expect(prepare).toBeLessThan(version);
  expect(version).toBeLessThan(finalize);
});

test("zizmor is pinned and fails the workflow on every finding", () => {
  const source = read(workflowsDir, "shared-zizmor.yml");
  const caller = read(workflowsDir, "zizmor.yml");
  const manifest = JSON.parse(readFileSync(`${root}package.json`, "utf8")) as {
    scripts: Record<string, string>;
  };

  expect(source).toContain(
    "uses: zizmorcore/zizmor-action@3dc1ecc9bcb9e94e9b2c709687979e1298497054 # v0.6.2",
  );
  expect(source).toMatch(/^ {10}version: "1\.29\.0"$/m);
  expect(source).toMatch(/^ {10}collect: default$/m);
  expect(source).toMatch(/^ {10}online-audits: true$/m);
  expect(source).toMatch(/^ {10}advanced-security: false$/m);
  expect(source).toMatch(/^ {10}annotations: true$/m);
  expect(source).toMatch(/^ {10}fail-on-no-inputs: true$/m);
  expect(source).not.toContain("security-events:");
  expect(caller).toMatch(/^ {6}persona: pedantic$/m);
  expect(manifest.scripts["lint-actions"]).toBe(
    "zizmor --strict-collection --collect=default --persona=pedantic .",
  );
});

test("Dependabot npm cooldowns match pnpm's release-age policy", () => {
  const workspace = readFileSync(`${root}pnpm-workspace.yaml`, "utf8");
  const configuredMinimumReleaseAge = workspace.match(/^minimumReleaseAge: (\d+)$/m)?.[1];
  if (configuredMinimumReleaseAge === undefined) {
    throw new Error("pnpm must explicitly configure minimumReleaseAge");
  }

  const minimumReleaseAgeMinutes = Number(configuredMinimumReleaseAge);
  expect(minimumReleaseAgeMinutes % 1440).toBe(0);
  expect(workspace).toMatch(/^minimumReleaseAgeStrict: true$/m);

  const cooldownDays = minimumReleaseAgeMinutes / 1440;
  const exclusions = yamlStringList(workspace, "minimumReleaseAgeExclude", 0).filter((selector) =>
    selector.startsWith("@") ? selector.indexOf("@", 1) < 0 : !selector.includes("@"),
  );
  expect(exclusions.length).toBeGreaterThan(0);

  for (const [directory, file] of [
    [`${root}.github/`, "dependabot.yml"],
    [examplesDir, "dependabot.yml"],
  ] as const) {
    const npm = dependabotUpdater(read(directory, file), "npm");

    expect(npm, `${file} must match pnpm's minimumReleaseAge`).toMatch(
      new RegExp(`^ {6}default-days: ${cooldownDays}(?: |$)`, "m"),
    );
    expect(yamlStringList(npm, "exclude", 6)).toStrictEqual(exclusions);
  }
});

test("Dependabot keeps GitHub Actions behind a seven-day cooldown", () => {
  for (const [directory, file] of [
    [`${root}.github/`, "dependabot.yml"],
    [examplesDir, "dependabot.yml"],
  ] as const) {
    const githubActions = dependabotUpdater(read(directory, file), "github-actions");
    expect(githubActions).toMatch(/^ {6}default-days: 7$/m);
  }
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
