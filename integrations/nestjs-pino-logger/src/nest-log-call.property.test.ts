import fc from "fast-check";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { runInNewContext } from "node:vm";

import { ConsoleLoggerParser, LOG_LEVELS } from "./Logger.test-harness.ts";
import { parseNestLogCall } from "./nest-log-call.ts";

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
      params: undefined,
      stack: undefined,
    });
    assert.deepStrictEqual(parseNestLogCall("error", "failed", [undefined, "Worker"]), {
      context: "Worker",
      messages: ["failed"],
      params: undefined,
      stack: undefined,
    });
  });

  void it("recognizes plain objects from other realms and without a prototype", () => {
    const oracle = new ConsoleLoggerParser();
    const foreignObject: unknown = runInNewContext("({ requestId: 'foreign' })");
    const nullPrototypeObject: Record<string, unknown> = Object.create(null);
    nullPrototypeObject["attempt"] = 2;
    const values = [foreignObject, nullPrototypeObject, "Worker"];

    assert.deepStrictEqual(
      parseNestLogCall("log", "processed", values),
      oracle.parseCall("log", "processed", values),
    );
    assert.deepStrictEqual(parseNestLogCall("log", "processed", values).params, {
      requestId: "foreign",
      attempt: 2,
    });
  });

  void it("merges structured params without invoking prototype setters", () => {
    const fields = Object.freeze(
      Object.fromEntries([
        ["__proto__", { polluted: true }],
        ["requestId", "request-1"],
      ]),
    );

    const { params } = parseNestLogCall("log", "processed", [fields, { attempt: 2 }]);

    assert.ok(params);
    assert.strictEqual(Object.getPrototypeOf(params), Object.prototype);
    assert.strictEqual(Object.hasOwn(params, "__proto__"), true);
    assert.deepStrictEqual(params["__proto__"], { polluted: true });
    assert.strictEqual(params["requestId"], "request-1");
    assert.strictEqual(params["attempt"], 2);
    assert.strictEqual(Object.hasOwn(fields, "attempt"), false);
  });
});
