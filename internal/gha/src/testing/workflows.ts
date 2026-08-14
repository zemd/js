import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const root: string = fileURLToPath(new URL("../../../../", import.meta.url));
export const workflowsDir: string = `${root}.github/workflows/`;
export const examplesDir: string = `${root}.github/workflows-examples/`;
export const scriptsDir: string = `${root}.github/scripts/`;

export const BUNDLE: string = "gha.mjs";

export const yamlFiles = (directory: string): string[] =>
  readdirSync(directory).filter((file) => file.endsWith(".yml") || file.endsWith(".yaml"));

export const workflowExampleFiles = (): string[] =>
  yamlFiles(examplesDir).filter((file) => file !== "dependabot.yml");

export const read = (directory: string, file: string): string =>
  readFileSync(directory + file, "utf8");

export const dependabotUpdater = (source: string, ecosystem: string): string => {
  const marker = `  - package-ecosystem: "${ecosystem}"`;
  const start = source.indexOf(marker);
  if (start < 0) throw new Error(`Dependabot does not configure ${ecosystem}`);

  const end = source.indexOf("\n  - package-ecosystem:", start + marker.length);
  return source.slice(start, end < 0 ? source.length : end);
};

export const yamlStringList = (source: string, key: string, indentation: number): string[] => {
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

export const usesReferences = (source: string): Array<{ reference: string; comment?: string }> =>
  [...source.matchAll(USES)].map(([, reference, comment]) => ({
    reference: reference ?? "",
    ...(comment === undefined ? {} : { comment }),
  }));

export const secretReferences = (source: string): string[] =>
  [...source.matchAll(/\$\{\{ secrets\.([A-Z_]+) \}\}/g)].map((match) => {
    const secret = match[1];
    if (secret === undefined) throw new Error("Secret reference capture is missing");
    return secret;
  });

export const usesAction = (source: string, action: string): boolean =>
  usesReferences(source).some(({ reference }) => reference.startsWith(`${action}@`));

export const workflowStep = (source: string, name: string): string => {
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

export const workflowJob = (source: string, name: string): string => {
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
