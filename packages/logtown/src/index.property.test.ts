import fc from "fast-check";
import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";

import {
  createLogger,
  disableOutput,
  LOG_LEVELS,
  LOGTOWN_RULES_SYMBOL,
  registerWrapper,
  type LoggerPayload,
  type LogLevel,
  type LogRule,
  type LogRuleStorage,
} from "./index.ts";

type LogMethod = (message: unknown, ...optionalParams: unknown[]) => void;
type RuleStatus = "disabled" | "enabled";
type RuleTarget = {
  enabled: boolean;
  level: LogLevel | "*";
  scope: "global" | "module";
};

const payloads: LoggerPayload[] = [];

registerWrapper((payload) => {
  payloads.push(payload);
});

const resetLoggingState = (): void => {
  (
    globalThis as typeof globalThis & {
      [LOGTOWN_RULES_SYMBOL]: LogRuleStorage;
    }
  )[LOGTOWN_RULES_SYMBOL] = new Map();
  payloads.length = 0;
};

const write = (
  id: string,
  level: LogLevel,
  message: unknown,
  optionalParams: unknown[] = [],
): void => {
  const method = level.toLowerCase() as Lowercase<LogLevel>;
  (createLogger(id)[method] as LogMethod)(message, ...optionalParams);
};

const logLevel = fc.constantFrom(...LOG_LEVELS);
const loggerId = fc.string({ maxLength: 64 });

/**
 * Exercise values that are legal log arguments but awkward to serialize: nested BigInts,
 * collections, typed arrays, dates, undefined and the non-finite numbers among them.
 */
const logValue = fc.anything({
  maxDepth: 3,
  maxKeys: 5,
  withBigInt: true,
  withDate: true,
  withMap: true,
  withSet: true,
  withTypedArray: true,
});

const nonStringMessage = fc.oneof(
  logValue.filter((value) => {
    return typeof value !== "string";
  }),
  fc.string({ maxLength: 32 }).map((description) => {
    return Symbol(description);
  }),
);

const ID_CHARACTERS = "abcdefghijklmnopqrstuvwxyz0123456789_-".split("");
const idSegment = fc.string({
  unit: fc.constantFrom(...ID_CHARACTERS),
  minLength: 1,
  maxLength: 12,
});

/** Logger ids may be namespaced with dots, so rules must split at their final separator. */
const ruleLoggerId = fc.array(idSegment, { minLength: 2, maxLength: 4 }).map((segments) => {
  return segments.join(".");
});

const ruleTarget = fc.record<RuleTarget>({
  enabled: fc.boolean(),
  level: fc.constantFrom("*" as const, ...LOG_LEVELS),
  scope: fc.constantFrom("global" as const, "module" as const),
});

const renderRule = (id: string, target: RuleTarget): LogRule => {
  const ruleId = target.scope === "global" ? "*" : id.toUpperCase();
  const ruleLevel = target.level === "*" ? "*" : target.level.toLowerCase();
  return `${target.enabled ? "!" : ""}${ruleId}.${ruleLevel}` as LogRule;
};

const expectedRuleStatus = (targets: RuleTarget[], level: LogLevel): RuleStatus => {
  const statuses = new Map<string, RuleStatus>();

  for (const target of targets) {
    statuses.set(`${target.scope}.${target.level}`, target.enabled ? "enabled" : "disabled");
  }

  return (
    statuses.get(`global.${level}`) ??
    statuses.get("global.*") ??
    statuses.get(`module.${level}`) ??
    statuses.get("module.*") ??
    "enabled"
  );
};

beforeEach(() => {
  resetLoggingState();
});

void describe("createLogger", () => {
  void it("should preserve arbitrary ids and cache one logger per exact id", () => {
    fc.assert(
      fc.property(loggerId, (id) => {
        const first = createLogger(id);

        assert.strictEqual(first.id, id);
        assert.strictEqual(createLogger(id), first);
      }),
      { numRuns: 2000 },
    );
  });
});

void describe("payloads", () => {
  void it("should preserve the routing and data of arbitrary string logs", () => {
    fc.assert(
      fc.property(
        loggerId,
        logLevel,
        fc.string({ maxLength: 128 }),
        fc.array(fc.jsonValue(), { maxLength: 5 }),
        (id, level, message, optionalParams) => {
          resetLoggingState();
          const startedAt = Date.now();

          write(id, level, message, optionalParams);

          const finishedAt = Date.now();
          assert.strictEqual(payloads.length, 1);
          const payload = payloads[0]!;
          assert.strictEqual(payload.id, id);
          assert.strictEqual(payload.level, level);
          assert.strictEqual(typeof payload.message, "string");
          assert.ok(payload.timestamp >= startedAt);
          assert.ok(payload.timestamp <= finishedAt);
          assert.strictEqual(payload.data.length, optionalParams.length);
          optionalParams.forEach((value, index) => {
            assert.strictEqual(payload.data[index], value);
          });
        },
      ),
      { numRuns: 3000 },
    );
  });

  void it("should interpolate arbitrary strings without losing the original argument", () => {
    const literal = fc.string({ maxLength: 48 }).filter((value) => {
      return !value.includes("%");
    });

    fc.assert(
      fc.property(
        loggerId,
        logLevel,
        literal,
        literal,
        literal,
        (id, level, prefix, value, suffix) => {
          resetLoggingState();

          write(id, level, `${prefix}|%s|${suffix}`, [value]);

          assert.strictEqual(payloads.length, 1);
          assert.strictEqual(payloads[0]?.message, `${prefix}|${value}|${suffix}`);
          assert.deepStrictEqual(payloads[0]?.data, [value]);
        },
      ),
      { numRuns: 2000 },
    );
  });

  void it("should fall back to the source text when a format string cannot be processed", () => {
    const formatterTrap = fc.constantFrom(
      "__proto__",
      "constructor",
      "hasOwnProperty",
      "toString",
      "valueOf",
      "%g",
      "%h",
    );

    fc.assert(
      fc.property(
        loggerId,
        logLevel,
        formatterTrap,
        fc.jsonValue(),
        (id, level, message, value) => {
          resetLoggingState();

          write(id, level, message, [value]);

          assert.strictEqual(payloads.length, 1);
          assert.strictEqual(payloads[0]?.message, message);
          assert.strictEqual(payloads[0]?.data[0], value);
        },
      ),
      { numRuns: 1000 },
    );
  });

  void it("should accept arbitrary non-string messages and retain every value by identity", () => {
    fc.assert(
      fc.property(
        loggerId,
        logLevel,
        nonStringMessage,
        fc.array(logValue, { maxLength: 5 }),
        (id, level, message, optionalParams) => {
          resetLoggingState();

          write(id, level, message, optionalParams);

          assert.strictEqual(payloads.length, 1);
          const payload = payloads[0]!;
          assert.strictEqual(typeof payload.message, "string");
          assert.strictEqual(payload.data.length, optionalParams.length + 1);
          assert.strictEqual(payload.data[0], message);
          optionalParams.forEach((value, index) => {
            assert.strictEqual(payload.data[index + 1], value);
          });
        },
      ),
      { numRuns: 3000 },
    );
  });
});

void describe("disableOutput", () => {
  void it("should apply arbitrary rule sets according to scope and specificity", () => {
    fc.assert(
      fc.property(
        ruleLoggerId,
        logLevel,
        fc.array(ruleTarget, { maxLength: 20 }),
        (id, level, targets) => {
          resetLoggingState();
          disableOutput(
            targets.map((target) => {
              return renderRule(id, target);
            }),
          );

          write(id, level, "probe");

          const expected = expectedRuleStatus(targets, level);
          assert.strictEqual(payloads.length, expected === "enabled" ? 1 : 0);
        },
      ),
      { numRuns: 3000 },
    );
  });
});
