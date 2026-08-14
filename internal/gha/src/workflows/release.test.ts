import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import {
  BUNDLE,
  examplesDir,
  read,
  root,
  secretReferences,
  usesAction,
  workflowJob,
  workflowStep,
  workflowsDir,
  yamlFiles,
} from "../testing/workflows.ts";

void test("release jobs configure the npm cache after runner allocation", () => {
  const source = read(workflowsDir, "shared-release.yml");

  for (const name of ["publish", "github-release"]) {
    const job = workflowJob(source, name);
    const configureCache = workflowStep(job, "Configure npm cache");

    assert.doesNotMatch(job, /^ {6}NPM_CONFIG_CACHE:/m);
    assert.ok(
      configureCache.includes(
        `run: printf 'NPM_CONFIG_CACHE=%s/npm-cache\\n' "$RUNNER_TEMP" >> "$GITHUB_ENV"`,
      ),
    );
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

void test("checkout-free release jobs give GitHub CLI an explicit repository", () => {
  const source = read(workflowsDir, "shared-release.yml");
  const releasePr = workflowJob(source, "release-pr");
  const openReleasePr = workflowStep(releasePr, "Open release pull request");

  assert.doesNotMatch(releasePr, /- name: Checkout Repo/);
  assert.match(openReleasePr, /^ {10}GH_REPO: \$\{\{ github\.repository \}\}$/m);
});

void test("checkout-free release jobs source pnpm from the shared tooling manifest", () => {
  const source = read(workflowsDir, "shared-release.yml");

  for (const name of ["version", "package"]) {
    const setupPnpm = workflowStep(workflowJob(source, name), "Setup pnpm");
    assert.doesNotMatch(setupPnpm, /^ {10}package_json_file:/m);
  }

  for (const name of ["publish", "github-release"]) {
    const job = workflowJob(source, name);
    const checkout = job.indexOf("- name: Checkout shared tooling");
    const setup = job.indexOf("- name: Setup pnpm");
    const setupPnpm = workflowStep(job, "Setup pnpm");

    assert.ok(checkout > -1);
    assert.ok(checkout < setup);
    assert.match(setupPnpm, /^ {10}package_json_file: \.shared-ci\/package\.json$/m);
  }
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

void test("keeps the npm token out of staging and requires it for first releases", () => {
  const source = read(workflowsDir, "shared-release.yml");
  const caller = read(workflowsDir, "repo-release.yml");
  const example = read(examplesDir, "repo-release.yml");
  const publishingModeStep = workflowStep(source, "Select npm publishing mode");
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
  assert.ok(!source.includes("- name: Reject first releases"));
  assert.match(stagedPublishingStep, /^ {8}if: steps\.publishing\.outputs\.stage == 'true'$/m);
  assert.ok(stagedPublishingStep.includes('node "${SHARED_CLI}" package-artifact tarball'));
  assert.ok(stagedPublishingStep.includes('pnpm stage publish "$tarball"'));
  assert.ok(stagedPublishingStep.includes('--registry "https://registry.npmjs.org"'));
  assert.ok(!stagedPublishingStep.includes("NPM_TOKEN"));
  assert.ok(!stagedPublishingStep.includes("NODE_AUTH_TOKEN"));
  assert.match(directPublishingStep, /^ {8}if: steps\.publishing\.outputs\.direct == 'true'$/m);
  assert.ok(
    directPublishingStep.includes("FIRST_RELEASE: ${{ steps.publishing.outputs.first_release }}"),
  );
  assert.ok(directPublishingStep.includes("NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}"));
  assert.ok(
    directPublishingStep.includes(
      'if [ "$FIRST_RELEASE" = "true" ] && [ -z "$NODE_AUTH_TOKEN" ]; then',
    ),
  );
  assert.ok(
    directPublishingStep.includes(
      "NPM_TOKEN is required to publish a package that does not exist in the registry.",
    ),
  );
  assert.ok(
    directPublishingStep.indexOf('[ -z "$NODE_AUTH_TOKEN" ]') <
      directPublishingStep.indexOf("while IFS= read -r package"),
  );
  assert.ok(directPublishingStep.includes('node "${SHARED_CLI}" package-artifact tarball'));
  assert.ok(directPublishingStep.includes('pnpm publish "$tarball"'));
  assert.ok(directPublishingStep.includes("--ignore-scripts"));
  assert.ok(directPublishingStep.includes('--registry "https://registry.npmjs.org"'));
  assert.match(source, /NPM_TOKEN:\n(?: {8}.*\n) {8}required: false/);
  assert.strictEqual(source.match(/NODE_AUTH_TOKEN: \$\{\{ secrets\.NPM_TOKEN \}\}/g)?.length, 1);
  assert.deepStrictEqual(
    secretReferences(source).sort((left, right) => left.localeCompare(right)),
    ["NPM_TOKEN", "RELEASE_BRANCHKEEPER_PRIVATE_KEY", "RELEASE_PUBLISHER_PRIVATE_KEY"],
  );
  assert.strictEqual(source.match(/^ {10}package-manager-cache: false$/gm)?.length, 4);
  assert.doesNotMatch(source, /^ {10}cache: "pnpm"$/m);
  assert.ok(source.includes('"${RUNNER_TEMP}/publication/published-summary.json"'));
  assert.ok(source.includes('"${RUNNER_TEMP}/publication/staged-summary.json"'));
  assert.ok(example.includes("# staged-publishing: true"));
  assert.ok(caller.includes("NPM_TOKEN: ${{ secrets.NPM_TOKEN }}"));
  assert.ok(example.includes("NPM_TOKEN: ${{ secrets.NPM_TOKEN }}"));
  assert.deepStrictEqual(
    secretReferences(example).sort((left, right) => left.localeCompare(right)),
    ["NPM_TOKEN", "RELEASE_BRANCHKEEPER_PRIVATE_KEY", "RELEASE_PUBLISHER_PRIVATE_KEY"],
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
