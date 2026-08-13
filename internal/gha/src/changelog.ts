import { lstatSync, readFileSync, realpathSync } from "node:fs";
import { isAbsolute, join, relative, resolve, sep } from "node:path";

const MAX_CHANGELOG_BYTES = 1024 * 1024;

const isWithin = (root: string, path: string): boolean => {
  const fromRoot = relative(root, path);
  return (
    fromRoot === "" ||
    (!isAbsolute(fromRoot) && fromRoot !== ".." && !fromRoot.startsWith(`..${sep}`))
  );
};

// Pulls the section for `version` out of a Keep a Changelog style file. Heading
// levels are demoted to bold because the entry is rendered inside <details>,
// where a real heading would dwarf the summary line.
export const changelogEntry = (packagePath: string, version: string): string => {
  let changelog: string;
  try {
    const root = realpathSync(resolve(packagePath));
    const path = join(root, "CHANGELOG.md");
    const metadata = lstatSync(path);
    if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.size > MAX_CHANGELOG_BYTES) {
      return "";
    }
    const canonical = realpathSync(path);
    if (!isWithin(root, canonical)) return "";
    changelog = readFileSync(canonical, "utf8");
  } catch {
    return "";
  }

  const lines = changelog.split("\n");
  const start = lines.findIndex(
    (line) =>
      line
        .trim()
        .replace(/\s+-\s+\d{4}-\d{2}-\d{2}$/, "")
        .replace(/[[\]]/g, "") === `## ${version}`,
  );
  if (start === -1) return "";

  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => line.startsWith("## "));

  return (end === -1 ? rest : rest.slice(0, end))
    .join("\n")
    .replace(/^#{1,6}\s+(.+)$/gm, "**$1**")
    .trim();
};
