import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  Logger,
  PinoMessageSymbol,
  buildPinoMessage,
  formatLogMessage,
} from "@zemd/nestjs-pino-logger";
import { benchmark, formatBenchmarkResult, toBencherMetricFormat } from "@zemd/testing";
import type { Logger as PinoLogger } from "pino";

let checksum = 0;
let request = 0;

const getValueSize = (value: unknown): number => {
  if (value === null || value === undefined) {
    return 0;
  }
  if (typeof value === "object" || typeof value === "function") {
    return Reflect.ownKeys(value).length;
  }
  if (typeof value === "symbol") {
    return value.description?.length ?? 0;
  }
  if (typeof value === "string") {
    return value.length;
  }
  return typeof value === "number" || typeof value === "bigint" || typeof value === "boolean"
    ? value.toString().length
    : 0;
};

const childLogger = {
  info(value: unknown, message?: unknown): void {
    checksum += getValueSize(value);
    if (message !== undefined) {
      checksum += getValueSize(message);
    }
  },
};
const pinoInstance = {
  child(bindings: Record<string, unknown>) {
    checksum += String(bindings["context"]).length;
    return childLogger;
  },
};
const logger = new Logger(pinoInstance as unknown as PinoLogger);

const results = [
  benchmark(
    "build structured message",
    () => {
      const message = buildPinoMessage({
        message: "Handled request %d",
        interpolationValues: [request],
        mergingObject: { requestId: request },
      });
      request += 1;
      checksum += message[PinoMessageSymbol] ? message.message.length : 0;
    },
    {
      iterations: 100_000,
      // Informational target: 1,000 structured messages within 2 ms.
      budgetNanoseconds: 2_000,
    },
  ),
  benchmark(
    "format cached-context log",
    () => {
      logger.log(formatLogMessage("Handled request %d", request), "Benchmark");
      request += 1;
    },
    {
      iterations: 50_000,
      // Informational target: 1,000 cached-context logs within 20 ms.
      budgetNanoseconds: 20_000,
    },
  ),
];

// Keep benchmark results observable so the runtime cannot discard the logging work.
if (!Number.isFinite(checksum) || checksum === 0) {
  throw new Error("logger benchmark produced an invalid checksum");
}

const outputDirectory = process.env["BENCHER_OUTPUT_DIR"];
if (outputDirectory) {
  mkdirSync(outputDirectory, { recursive: true });
  writeFileSync(
    join(outputDirectory, "zemd-nestjs-pino-logger.json"),
    `${JSON.stringify(
      toBencherMetricFormat(results, { namespace: "@zemd/nestjs-pino-logger" }),
    )}\n`,
    "utf8",
  );
} else {
  console.table(results.map(formatBenchmarkResult));
}
