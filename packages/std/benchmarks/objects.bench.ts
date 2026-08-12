import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { benchmark, formatBenchmarkResult, toBencherMetricFormat } from "@zemd/testing";

import { merge } from "@zemd/std-modules/objects";

const shallowDefaults = {
  retries: 2,
  timeout: 5_000,
  headers: { accept: "application/json" },
};
const shallowOverrides = {
  retries: 4,
  timeout: 10_000,
  cache: true,
};

const nestedDefaults = {
  server: {
    host: "localhost",
    port: 3_000,
    tls: { enabled: false, certificates: [] },
  },
  logging: {
    level: "info",
    destinations: ["stdout"],
  },
};
const nestedOverrides = {
  server: {
    port: 8_080,
    tls: { enabled: true, certificates: ["development.pem"] },
  },
  logging: {
    level: "debug",
  },
};

let checksum = 0;
const results = [
  benchmark(
    "merge shallow objects",
    () => {
      checksum += Object.keys(merge(shallowDefaults, shallowOverrides)).length;
    },
    {
      iterations: 10_000,
      // Informational target: 1,000 shallow merges within 10 ms.
      budgetNanoseconds: 10_000,
    },
  ),
  benchmark(
    "merge nested objects",
    () => {
      checksum += Object.keys(merge(nestedDefaults, nestedOverrides)).length;
    },
    {
      iterations: 10_000,
      // Informational target: 1,000 nested merges within 50 ms.
      budgetNanoseconds: 50_000,
    },
  ),
];

// Keep benchmark results observable so the runtime cannot discard the merge work.
if (checksum === 0) {
  throw new Error("object benchmark produced an empty checksum");
}

const outputDirectory = process.env["BENCHER_OUTPUT_DIR"];
if (outputDirectory) {
  mkdirSync(outputDirectory, { recursive: true });
  writeFileSync(
    join(outputDirectory, "zemd-std-modules.json"),
    `${JSON.stringify(toBencherMetricFormat(results, { namespace: "@zemd/std-modules" }))}\n`,
    "utf8",
  );
} else {
  console.table(results.map(formatBenchmarkResult));
}
