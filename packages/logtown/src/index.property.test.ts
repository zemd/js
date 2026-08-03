import fc from "fast-check";
import { beforeEach, describe, expect, it } from "vitest";
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
} from "./index.js";

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

describe("createLogger", () => {
  it("should preserve arbitrary ids and cache one logger per exact id", () => {
    fc.assert(
      fc.property(loggerId, (id) => {
        const first = createLogger(id);

        expect(first.id).toBe(id);
        expect(createLogger(id)).toBe(first);
      }),
      { numRuns: 2000 },
    );
  });
});

describe("payloads", () => {
  it("should preserve the routing and data of arbitrary string logs", () => {
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
          expect(payloads).toHaveLength(1);
          const payload = payloads[0]!;
          expect(payload.id).toBe(id);
          expect(payload.level).toBe(level);
          expect(payload.message).toBeTypeOf("string");
          expect(payload.timestamp).toBeGreaterThanOrEqual(startedAt);
          expect(payload.timestamp).toBeLessThanOrEqual(finishedAt);
          expect(payload.data).toHaveLength(optionalParams.length);
          optionalParams.forEach((value, index) => {
            expect(payload.data[index]).toBe(value);
          });
        },
      ),
      { numRuns: 3000 },
    );
  });

  it("should interpolate arbitrary strings without losing the original argument", () => {
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

          expect(payloads).toHaveLength(1);
          expect(payloads[0]?.message).toBe(`${prefix}|${value}|${suffix}`);
          expect(payloads[0]?.data).toEqual([value]);
        },
      ),
      { numRuns: 2000 },
    );
  });

  it("should fall back to the source text when a format string cannot be processed", () => {
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

          expect(payloads).toHaveLength(1);
          expect(payloads[0]?.message).toBe(message);
          expect(payloads[0]?.data[0]).toBe(value);
        },
      ),
      { numRuns: 1000 },
    );
  });

  it("should accept arbitrary non-string messages and retain every value by identity", () => {
    fc.assert(
      fc.property(
        loggerId,
        logLevel,
        nonStringMessage,
        fc.array(logValue, { maxLength: 5 }),
        (id, level, message, optionalParams) => {
          resetLoggingState();

          write(id, level, message, optionalParams);

          expect(payloads).toHaveLength(1);
          const payload = payloads[0]!;
          expect(payload.message).toBeTypeOf("string");
          expect(payload.data).toHaveLength(optionalParams.length + 1);
          expect(payload.data[0]).toBe(message);
          optionalParams.forEach((value, index) => {
            expect(payload.data[index + 1]).toBe(value);
          });
        },
      ),
      { numRuns: 3000 },
    );
  });
});

describe("disableOutput", () => {
  it("should apply arbitrary rule sets according to scope and specificity", () => {
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
          expect(payloads).toHaveLength(expected === "enabled" ? 1 : 0);
        },
      ),
      { numRuns: 3000 },
    );
  });
});
