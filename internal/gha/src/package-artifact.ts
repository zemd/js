import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { lstatSync, readFileSync, readdirSync, realpathSync, writeFileSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";

import { changelogEntry } from "./changelog.ts";
import { isPublicWorkspacePackage } from "./pnpm.ts";
import type { PublishedPackage, WorkspacePackage } from "./pnpm.ts";

const MAX_PACKAGES = 100;
const MAX_TARBALL_BYTES = 50 * 1024 * 1024;
const MAX_TOTAL_BYTES = 500 * 1024 * 1024;
const MAX_CHANGELOG_BYTES = 1024 * 1024;
const NPM_REGISTRY = "https://registry.npmjs.org";
const PACKAGE_NAME = /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/;
const PACKAGE_VERSION = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const TARBALL_NAME = /^package-\d{4}\.tgz$/;

export interface PackageArtifactEntry {
  readonly changelog: string;
  readonly file: string;
  readonly name: string;
  readonly path: string;
  readonly sha256: string;
  readonly version: string;
}

export interface PackageArtifactManifest {
  readonly packages: readonly PackageArtifactEntry[];
}

export type PackagePacker = (packagePath: string, outputPath: string) => void;
export type PackageInspector = (tarballPath: string) => PublishedPackage;

const isWithin = (root: string, path: string): boolean => {
  const fromRoot = relative(root, path);
  return (
    fromRoot === "" ||
    (!isAbsolute(fromRoot) && fromRoot !== ".." && !fromRoot.startsWith(`..${sep}`))
  );
};

const record = (value: unknown, context: string): Record<string, unknown> => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${context}: expected an object`);
  }
  return value as Record<string, unknown>;
};

const exactKeys = (
  value: Record<string, unknown>,
  expected: readonly string[],
  context: string,
) => {
  if (Object.keys(value).sort().join("\0") !== [...expected].sort().join("\0")) {
    throw new Error(`${context}: expected only ${expected.join(", ")}`);
  }
};

const stringField = (value: Record<string, unknown>, key: string, context: string): string => {
  const field = value[key];
  if (typeof field !== "string") throw new Error(`${context}.${key}: expected a string`);
  return field;
};

const portablePath = (path: string): string => {
  if (path === ".") return path;
  if (
    path.length === 0 ||
    path.length > 4_096 ||
    path.includes("\\") ||
    isAbsolute(path) ||
    path.startsWith("../") ||
    path.split("/").some((segment) => segment === "" || segment === "." || segment === "..")
  ) {
    throw new Error(`invalid workspace path: ${JSON.stringify(path)}`);
  }
  return path;
};

const validateNameVersion = (name: string, version: string): void => {
  if (name.length > 214 || !PACKAGE_NAME.test(name)) {
    throw new Error(`invalid npm package name: ${JSON.stringify(name)}`);
  }
  if (!PACKAGE_VERSION.test(version)) {
    throw new Error(`invalid npm package version: ${JSON.stringify(version)}`);
  }
};

const regularTarball = (directory: string, file: string): { path: string; size: number } => {
  if (!TARBALL_NAME.test(file)) throw new Error(`invalid release tarball name: ${file}`);
  const path = resolve(directory, file);
  if (!isWithin(directory, path))
    throw new Error(`release tarball is outside its artifact: ${file}`);
  const metadata = lstatSync(path);
  if (
    !metadata.isFile() ||
    metadata.isSymbolicLink() ||
    metadata.size === 0 ||
    metadata.size > MAX_TARBALL_BYTES
  ) {
    throw new Error(
      `${file} must be a non-empty regular file of at most ${MAX_TARBALL_BYTES} bytes`,
    );
  }
  if (realpathSync(path) !== path) throw new Error(`${file} must not traverse a symbolic link`);
  return { path, size: metadata.size };
};

const hash = (path: string): string => {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
};

const artifactDirectory = (path: string): string => {
  const absolute = realpathSync(resolve(path));
  const metadata = lstatSync(resolve(path));
  if (!metadata.isDirectory() || metadata.isSymbolicLink()) {
    throw new Error(`${path} must be a regular directory`);
  }
  return absolute;
};

const defaultPack: PackagePacker = (packagePath, outputPath) => {
  execFileSync("pnpm", ["--dir", packagePath, "pack", "--out", outputPath], {
    stdio: "inherit",
  });
};

const defaultInspect: PackageInspector = (tarballPath) => {
  const source = execFileSync(
    "pnpm",
    [
      "publish",
      tarballPath,
      "--dry-run",
      "--json",
      "--ignore-scripts",
      "--no-git-checks",
      "--registry",
      NPM_REGISTRY,
    ],
    { encoding: "utf8" },
  );
  const value = record(JSON.parse(source) as unknown, `dry-run metadata for ${tarballPath}`);
  return {
    name: stringField(value, "name", `dry-run metadata for ${tarballPath}`),
    version: stringField(value, "version", `dry-run metadata for ${tarballPath}`),
  };
};

const parseManifest = (source: string): PackageArtifactManifest => {
  const value = record(JSON.parse(source) as unknown, "package artifact manifest");
  exactKeys(value, ["packages"], "package artifact manifest");
  if (!Array.isArray(value["packages"]) || value["packages"].length > MAX_PACKAGES) {
    throw new Error(`package artifact manifest must contain at most ${MAX_PACKAGES} packages`);
  }

  const names = new Set<string>();
  const files = new Set<string>();
  const packages = value["packages"].map((entry, index) => {
    const context = `package artifact manifest.packages[${index}]`;
    const item = record(entry, context);
    exactKeys(item, ["changelog", "file", "name", "path", "sha256", "version"], context);
    const result = {
      changelog: stringField(item, "changelog", context),
      file: stringField(item, "file", context),
      name: stringField(item, "name", context),
      path: portablePath(stringField(item, "path", context)),
      sha256: stringField(item, "sha256", context),
      version: stringField(item, "version", context),
    };
    validateNameVersion(result.name, result.version);
    if (!TARBALL_NAME.test(result.file) || !/^[a-f0-9]{64}$/.test(result.sha256)) {
      throw new Error(`${context}: invalid tarball filename or SHA-256 digest`);
    }
    if (Buffer.byteLength(result.changelog) > MAX_CHANGELOG_BYTES) {
      throw new Error(`${context}: changelog is too large`);
    }
    if (names.has(result.name) || files.has(result.file)) {
      throw new Error(`${context}: duplicate package name or tarball`);
    }
    names.add(result.name);
    files.add(result.file);
    return result;
  });
  return { packages };
};

export interface CreatePackageArtifactInput {
  readonly directory: string;
  readonly pack?: PackagePacker;
  readonly root?: string;
  readonly workspace: readonly WorkspacePackage[];
}

export const createPackageArtifact = ({
  directory: inputDirectory,
  pack = defaultPack,
  root = process.cwd(),
  workspace,
}: CreatePackageArtifactInput): PackageArtifactManifest => {
  const directory = artifactDirectory(inputDirectory);
  if (readdirSync(directory).length !== 0)
    throw new Error("package artifact directory is not empty");
  const canonicalRoot = realpathSync(resolve(root));
  const publicPackages = workspace.filter(isPublicWorkspacePackage);
  if (publicPackages.length === 0 || publicPackages.length > MAX_PACKAGES) {
    throw new Error(`expected between 1 and ${MAX_PACKAGES} public packages`);
  }

  const packages = publicPackages.map((workspacePackage, index) => {
    validateNameVersion(workspacePackage.name, workspacePackage.version);
    const sourcePackagePath = resolve(canonicalRoot, workspacePackage.path);
    const packagePath = realpathSync(sourcePackagePath);
    if (!isWithin(canonicalRoot, packagePath)) {
      throw new Error(`workspace package is outside the repository: ${workspacePackage.path}`);
    }
    const packageMetadata = lstatSync(sourcePackagePath);
    if (!packageMetadata.isDirectory() || packageMetadata.isSymbolicLink()) {
      throw new Error(`workspace package is not a regular directory: ${workspacePackage.path}`);
    }

    const file = `package-${String(index).padStart(4, "0")}.tgz`;
    const outputPath = resolve(directory, file);
    pack(packagePath, outputPath);
    regularTarball(directory, file);
    return {
      changelog: changelogEntry(packagePath, workspacePackage.version),
      file,
      name: workspacePackage.name,
      path: portablePath(relative(canonicalRoot, packagePath).split(sep).join("/")),
      sha256: hash(outputPath),
      version: workspacePackage.version,
    };
  });

  const manifest = { packages };
  writeFileSync(resolve(directory, "manifest.json"), `${JSON.stringify(manifest)}\n`, {
    encoding: "utf8",
    flag: "wx",
    mode: 0o600,
  });
  return manifest;
};

export interface ValidatePackageArtifactInput {
  readonly directory: string;
  readonly inspect?: PackageInspector;
}

export const validatePackageArtifact = ({
  directory: inputDirectory,
  inspect = defaultInspect,
}: ValidatePackageArtifactInput): PackageArtifactManifest => {
  const directory = artifactDirectory(inputDirectory);
  const entries = readdirSync(directory).sort();
  const manifestPath = resolve(directory, "manifest.json");
  const manifestMetadata = lstatSync(manifestPath);
  if (
    !manifestMetadata.isFile() ||
    manifestMetadata.isSymbolicLink() ||
    manifestMetadata.size > MAX_CHANGELOG_BYTES
  ) {
    throw new Error("manifest.json must be a regular file of at most 1 MiB");
  }
  const manifest = parseManifest(readFileSync(manifestPath, "utf8"));
  const expected = ["manifest.json", ...manifest.packages.map(({ file }) => file)].sort();
  if (entries.join("\0") !== expected.join("\0")) {
    throw new Error("package artifact contains unexpected or missing files");
  }

  let totalBytes = 0;
  for (const packageEntry of manifest.packages) {
    const tarball = regularTarball(directory, packageEntry.file);
    totalBytes += tarball.size;
    if (totalBytes > MAX_TOTAL_BYTES) {
      throw new Error(`package artifact exceeds ${MAX_TOTAL_BYTES} bytes`);
    }
    if (hash(tarball.path) !== packageEntry.sha256) {
      throw new Error(`SHA-256 mismatch for ${packageEntry.file}`);
    }
    const inspected = inspect(tarball.path);
    if (inspected.name !== packageEntry.name || inspected.version !== packageEntry.version) {
      throw new Error(`package metadata mismatch for ${packageEntry.file}`);
    }
  }
  return manifest;
};

export const workspaceFromPackageArtifact = (
  manifest: PackageArtifactManifest,
): readonly WorkspacePackage[] => {
  return manifest.packages.map(({ name, path, version }) => ({
    name,
    path,
    private: false,
    version,
  }));
};

export const tarballForPackage = (
  directory: string,
  manifest: PackageArtifactManifest,
  packageName: string,
): string => {
  const entry = manifest.packages.find(({ name }) => name === packageName);
  if (!entry) throw new Error(`package is absent from the release artifact: ${packageName}`);
  const artifact = artifactDirectory(directory);
  const tarball = regularTarball(artifact, entry.file);
  if (hash(tarball.path) !== entry.sha256) throw new Error(`SHA-256 mismatch for ${entry.file}`);
  return tarball.path;
};

export const publishSummary = (
  manifest: PackageArtifactManifest,
  packageNames: readonly string[],
): { readonly publishedPackages: readonly PublishedPackage[] } => {
  const unique = new Set(packageNames);
  if (unique.size !== packageNames.length) throw new Error("publish summary contains duplicates");
  return {
    publishedPackages: packageNames.map((packageName) => {
      const entry = manifest.packages.find(({ name }) => name === packageName);
      if (!entry) throw new Error(`package is absent from the release artifact: ${packageName}`);
      return { name: entry.name, version: entry.version };
    }),
  };
};

export const parsePackageArtifactManifest = (source: string): PackageArtifactManifest => {
  return parseManifest(source);
};
