import fc from "fast-check";
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ConsoleLogger, type LogLevel } from "@nestjs/common";

import { LOG_LEVELS } from "./Logger.test-harness.ts";
import { parseNestLogCall, type ParsedNestLogCall } from "./nest-log-call.ts";

class ConsoleLoggerParser extends ConsoleLogger {
  parseCall(
    level: LogLevel,
    message: unknown,
    optionalParameters: readonly unknown[],
  ): ParsedNestLogCall {
    const values = [message, ...optionalParameters];
    if (level !== "error") {
      const parsed = this.getContextAndMessagesToPrint(values);
      return { ...parsed, stack: undefined };
    }

    const parsed = this.getContextAndStackAndMessagesToPrint(values);
    return {
      context: parsed.context,
      messages: parsed.messages,
      stack: "stack" in parsed ? parsed.stack : undefined,
    };
  }
}

const logValue = fc.oneof(
  fc.jsonValue(),
  fc.constant(undefined),
  fc.constant("Error: generated\n    at run (/workspace/job.ts:1:1)"),
);

void describe("NestJS log-call parsing", () => {
  void it("matches the installed ConsoleLogger for arbitrary calls", () => {
    const oracle = new ConsoleLoggerParser();

    fc.assert(
      fc.property(
        fc.constantFrom(...LOG_LEVELS),
        logValue,
        fc.array(logValue, { maxLength: 6 }),
        (level, message, optionalParameters) => {
          assert.deepStrictEqual(
            parseNestLogCall(level, message, optionalParameters),
            oracle.parseCall(level, message, optionalParameters),
          );
        },
      ),
      { numRuns: 3000 },
    );
  });

  void it("preserves NestJS's two-argument undefined-stack distinction", () => {
    assert.deepStrictEqual(parseNestLogCall("error", "failed", [undefined]), {
      context: undefined,
      messages: ["failed", undefined],
      stack: undefined,
    });
    assert.deepStrictEqual(parseNestLogCall("error", "failed", [undefined, "Worker"]), {
      context: "Worker",
      messages: ["failed"],
      stack: undefined,
    });
  });
});
