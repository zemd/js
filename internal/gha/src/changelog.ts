import { readFileSync } from "node:fs";
import { join } from "node:path";

// Pulls the section for `version` out of a Keep a Changelog style file. Heading
// levels are demoted to bold because the entry is rendered inside <details>,
// where a real heading would dwarf the summary line.
export const changelogEntry = (packagePath: string, version: string): string => {
  let changelog: string;
  try {
    changelog = readFileSync(join(packagePath, "CHANGELOG.md"), "utf8");
  } catch {
    return "";
  }

  const lines = changelog.split("\n");
  const start = lines.findIndex((line) => line.trim().replace(/[[\]]/g, "") === `## ${version}`);
  if (start === -1) return "";

  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => line.startsWith("## "));

  return (end === -1 ? rest : rest.slice(0, end))
    .join("\n")
    .replace(/^#{1,6}\s+(.+)$/gm, "**$1**")
    .trim();
};
