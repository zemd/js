// Validators for the JSON that pnpm hands to the release scripts. They exist so
// a change in pnpm's output shape fails here, with the offending value in the
// message, instead of somewhere deep in a half-finished release.

export interface AppliedRelease {
  readonly name: string;
  readonly currentVersion: string;
  readonly newVersion: string;
}

interface WorkspacePackageIdentity {
  readonly name: string;
  readonly path: string;
}

export type WorkspacePackage = WorkspacePackageIdentity &
  (
    | { readonly version: string; readonly private: boolean }
    | { readonly version?: never; readonly private: true }
  );

export type PublicWorkspacePackage = WorkspacePackageIdentity & {
  readonly version: string;
  readonly private: false;
};

export interface PublishedPackage {
  readonly name: string;
  readonly version: string;
}

const asArray = (value: unknown, context: string): readonly unknown[] => {
  if (!Array.isArray(value)) {
    throw new Error(`${context}: expected an array, got ${typeof value}`);
  }
  return value;
};

const asRecord = (value: unknown, context: string): Record<string, unknown> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${context}: expected an object, got ${JSON.stringify(value)}`);
  }
  return value as Record<string, unknown>;
};

const asString = (source: Record<string, unknown>, key: string, context: string): string => {
  const value = source[key];
  if (typeof value !== "string") {
    throw new Error(`${context}: expected "${key}" to be a string, got ${JSON.stringify(value)}`);
  }
  return value;
};

export const isPublicWorkspacePackage = (
  workspacePackage: WorkspacePackage,
): workspacePackage is PublicWorkspacePackage => !workspacePackage.private;

export const parseAppliedReleases = (json: string): readonly AppliedRelease[] =>
  asArray(JSON.parse(json), "pnpm version -r --json").map((entry, index) => {
    const context = `pnpm version -r --json[${index}]`;
    const record = asRecord(entry, context);
    return {
      name: asString(record, "name", context),
      currentVersion: asString(record, "currentVersion", context),
      newVersion: asString(record, "newVersion", context),
    };
  });

export const parseWorkspacePackages = (json: string): readonly WorkspacePackage[] =>
  asArray(JSON.parse(json), "pnpm list -r --json").map((entry, index) => {
    const context = `pnpm list -r --json[${index}]`;
    const record = asRecord(entry, context);
    const name = asString(record, "name", context);
    const path = asString(record, "path", context);
    const isPrivate = record["private"] === true;

    if (record["version"] === undefined && isPrivate) {
      return { name, path, private: true };
    }

    return {
      name,
      version: asString(record, "version", context),
      path,
      private: isPrivate,
    };
  });

export const parsePublishSummary = (json: string): readonly PublishedPackage[] => {
  const summary = asRecord(JSON.parse(json), "pnpm publish --report-summary");
  const published = summary["publishedPackages"];
  if (published === undefined) return [];

  return asArray(published, "pnpm publish --report-summary.publishedPackages").map(
    (entry, index) => {
      const context = `pnpm publish --report-summary.publishedPackages[${index}]`;
      const record = asRecord(entry, context);
      return {
        name: asString(record, "name", context),
        version: asString(record, "version", context),
      };
    },
  );
};
