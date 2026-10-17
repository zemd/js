import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Logger as NestLogger } from "@nestjs/common";

import pino, { type Logger as PinoLogger } from "pino";

import {
  createLoggerHarness,
  LOG_LEVELS,
  PINO_LEVEL_BY_NEST_LEVEL,
  writeLog,
} from "./Logger.test-harness.ts";
import {
  buildPinoMessage,
  formatLogMessage,
  Logger,
  PinoMessageSymbol,
} from "@zemd/nestjs-pino-logger";

void describe("Logger", () => {
  void it("maps every NestJS level to its standard Pino level", () => {
    const { childBindings, calls, logger } = createLoggerHarness();

    for (const level of LOG_LEVELS) {
      writeLog(logger, level, `level ${level}`, [`Route:${level}`]);
    }

    assert.deepStrictEqual(
      childBindings,
      LOG_LEVELS.map((level) => {
        return { context: `Route:${level}` };
      }),
    );
    assert.strictEqual(calls.length, LOG_LEVELS.length);
    for (const [index, level] of LOG_LEVELS.entries()) {
      assert.deepStrictEqual(calls[index], {
        arguments: [`level ${level}`],
        bindings: { context: `Route:${level}` },
        level: PINO_LEVEL_BY_NEST_LEVEL[level],
      });
    }
  });

  void it("emits structured messages without mutation or prototype pollution", () => {
    const { calls, logger } = createLoggerHarness();
    const mergingObject = Object.fromEntries([
      ["requestId", "01JABC"],
      ["__proto__", { polluted: true }],
    ]);
    const input = {
      message: "Hello %s %d",
      interpolationValues: ["world"],
      mergingObject,
    };
    const structuredMessage = buildPinoMessage(input);

    logger.log(structuredMessage, 42, "Structured");
    logger.log(buildPinoMessage({ message: "ready" }), "Structured:plain");

    assert.notStrictEqual(structuredMessage, input);
    assert.strictEqual(structuredMessage[PinoMessageSymbol], true);
    assert.strictEqual(Object.hasOwn(input, PinoMessageSymbol), false);
    assert.strictEqual(calls.length, 3);
    const structuredRecord = calls[0]?.arguments[0];
    assert.ok(structuredRecord && typeof structuredRecord === "object");
    assert.strictEqual(Object.getPrototypeOf(structuredRecord), Object.prototype);
    assert.strictEqual(Object.hasOwn(structuredRecord, "__proto__"), true);
    assert.deepStrictEqual(Reflect.get(structuredRecord, "__proto__"), { polluted: true });
    assert.strictEqual(Reflect.get(structuredRecord, "requestId"), "01JABC");
    assert.strictEqual(Object.hasOwn(structuredRecord, "formattedMsg"), false);
    assert.strictEqual(Object.hasOwn(structuredRecord, PinoMessageSymbol), false);
    assert.deepStrictEqual(calls[0], {
      arguments: [structuredRecord, "Hello world %d"],
      bindings: { context: "Structured" },
      level: "info",
    });
    assert.deepStrictEqual(calls[1], {
      arguments: ["42"],
      bindings: { context: "Structured" },
      level: "info",
    });
    assert.deepStrictEqual(calls[2], {
      arguments: [{}, "ready"],
      bindings: { context: "Structured:plain" },
      level: "info",
    });
  });

  void it("preserves object fields for Pino redaction", () => {
    const output: string[] = [];
    const pinoInstance = pino(
      {
        level: "trace",
        redact: ["password", "credentials.token", "params.password", "params.credentials.token"],
      },
      {
        write(message: string) {
          output.push(message);
        },
      },
    );
    const logger = new Logger(pinoInstance);

    logger.log(
      {
        credentials: { token: "nested-secret" },
        password: "top-level-secret",
        user: "alice",
      },
      "Security",
    );
    logger.log(
      buildPinoMessage({
        mergingObject: { password: "structured-secret" },
        message: "structured login",
      }),
      "Security",
    );
    logger.log(
      "login",
      { password: "params-secret", credentials: { token: "params-token-secret" } },
      "Security",
    );

    assert.strictEqual(output.length, 3);
    const records = output.map((line) => {
      return JSON.parse(line) as Record<string, unknown>;
    });
    assert.strictEqual(records[0]?.["password"], "[Redacted]");
    assert.deepStrictEqual(records[0]?.["credentials"], { token: "[Redacted]" });
    assert.strictEqual(records[1]?.["password"], "[Redacted]");
    assert.deepStrictEqual(records[2]?.["params"], {
      password: "[Redacted]",
      credentials: { token: "[Redacted]" },
    });
    assert.ok(output.every((line) => !line.includes("secret")));
    assert.ok(records.every((record) => !Object.hasOwn(record, "formattedMsg")));
  });

  void it("logs null, Error values, and explicit stacks through their respective paths", () => {
    const { calls, logger } = createLoggerHarness();
    const error = new Error("database unavailable");
    const stack = "Error: request failed\n    at run (/workspace/job.ts:1:1)";

    logger.warn(null, "Nullable");
    logger.error(error, "Errors");
    logger.error("request failed", stack, "Errors:stack");
    logger.error("custom failure", "custom stack text", "Errors:custom");
    logger.error("undefined stack", undefined, "Errors:undefined");
    const details = { attempt: 2 };
    logger.error("multi failure", details, "multi stack", "Errors:multi");

    assert.deepStrictEqual(calls[0], {
      arguments: ["null"],
      bindings: { context: "Nullable" },
      level: "warn",
    });
    assert.deepStrictEqual(calls[1], {
      arguments: [{ err: error }, "database unavailable"],
      bindings: { context: "Errors" },
      level: "error",
    });
    assert.deepStrictEqual(calls[2], {
      arguments: [{ err: { message: "request failed", stack, type: "Error" } }, "request failed"],
      bindings: { context: "Errors:stack" },
      level: "error",
    });
    assert.deepStrictEqual(calls[3], {
      arguments: [
        {
          err: { message: "custom failure", stack: "custom stack text", type: "Error" },
        },
        "custom failure",
      ],
      bindings: { context: "Errors:custom" },
      level: "error",
    });
    assert.deepStrictEqual(calls[4], {
      arguments: ["undefined stack"],
      bindings: { context: "Errors:undefined" },
      level: "error",
    });
    assert.deepStrictEqual(calls[5], {
      arguments: [
        {
          params: details,
          err: { message: "multi failure", stack: "multi stack", type: "Error" },
        },
        "multi failure",
      ],
      bindings: { context: "Errors:multi" },
      level: "error",
    });
    assert.strictEqual(calls.length, 6);
  });

  void it("preserves optional messages and combines them only through formatLogMessage", () => {
    const { calls, childBindings, logger } = createLoggerHarness();
    const value = { id: 42 };

    logger.log("contextless");
    logger.log("value: %j", value);
    logger.log(formatLogMessage("value: %j", value));

    assert.deepStrictEqual(childBindings, []);
    assert.deepStrictEqual(calls, [
      { arguments: ["contextless"], level: "info" },
      { arguments: [{ params: value }, "value: %j"], level: "info" },
      { arguments: ['value: {"id":42}'], level: "info" },
    ]);
  });

  void it("emits every NestJS message in order under the same context", () => {
    const { calls, logger } = createLoggerHarness();
    const record = { requestId: "01JABC" };

    logger.log("first", record, 42, "Ordered");

    assert.deepStrictEqual(calls, [
      { arguments: [{ params: record }, "first"], bindings: { context: "Ordered" }, level: "info" },
      { arguments: [{ params: record }, "42"], bindings: { context: "Ordered" }, level: "info" },
    ]);
  });

  void it("merges optional plain objects into params for every level without mutating them", () => {
    const { calls, logger } = createLoggerHarness();
    const first = Object.freeze({ requestId: "request-1", attempt: 1 });
    const second = Object.freeze({ attempt: 2 });

    for (const level of LOG_LEVELS) {
      writeLog(logger, level, "processed", [first, second, "Worker"]);
    }

    assert.deepStrictEqual(
      calls,
      LOG_LEVELS.map((level) => ({
        arguments: [{ params: { requestId: "request-1", attempt: 2 } }, "processed"],
        bindings: { context: "Worker" },
        level: PINO_LEVEL_BY_NEST_LEVEL[level],
      })),
    );
    assert.deepStrictEqual(first, { requestId: "request-1", attempt: 1 });
    assert.deepStrictEqual(second, { attempt: 2 });
  });

  void it("preserves params alongside objects, errors, and buildPinoMessage fields", () => {
    const { calls, logger } = createLoggerHarness();
    const params = { requestId: "request-1" };
    const error = new Error("failed");

    logger.log({ user: "alice" }, params);
    logger.error(error, params);
    logger.log(
      buildPinoMessage({
        message: "user %s",
        interpolationValues: ["alice"],
        mergingObject: { user: "alice" },
      }),
      params,
    );

    assert.deepStrictEqual(calls, [
      { arguments: [{ user: "alice", params }], level: "info" },
      { arguments: [{ err: error, params }, "failed"], level: "error" },
      { arguments: [{ user: "alice", params }, "user alice"], level: "info" },
    ]);
  });

  void it("keeps arrays and class instances as separate messages", () => {
    const { calls, logger } = createLoggerHarness();
    const array = [1, 2];
    const date = new Date(0);
    const error = new Error("failed");

    logger.log("first", array, date, error);

    assert.deepStrictEqual(calls, [
      { arguments: ["first"], level: "info" },
      { arguments: [array], level: "info" },
      { arguments: [date], level: "info" },
      { arguments: [{ err: error }, "failed"], level: "info" },
    ]);
  });

  void it("parses error and fatal stacks with params, with or without a context", () => {
    const stack = "Error: failed\n    at run (/workspace/job.ts:1:1)";
    const params = { attempt: 2 };

    for (const level of ["error", "fatal"] as const) {
      const { calls, logger } = createLoggerHarness();
      logger[level]("failed", params, stack);
      logger[level]("failed", params, stack, "Worker");
      logger[level]("failed", stack);

      const err = { message: "failed", stack, type: "Error" };
      assert.deepStrictEqual(calls, [
        { arguments: [{ params, err }, "failed"], level },
        { arguments: [{ params, err }, "failed"], bindings: { context: "Worker" }, level },
        { arguments: [{ err }, "failed"], level },
      ]);
    }
  });

  void it("handles NestJS Logger delegation with its bound context", () => {
    const { calls, logger } = createLoggerHarness();
    const previousLogger = new NestLogger().localInstance;
    NestLogger.overrideLogger(logger);
    try {
      const nestLogger = new NestLogger("Application");
      nestLogger.log("started", { port: 3000 });
      assert.deepStrictEqual(calls, [
        {
          arguments: [{ params: { port: 3000 } }, "started"],
          bindings: { context: "Application" },
          level: "info",
        },
      ]);
    } finally {
      NestLogger.overrideLogger(previousLogger);
    }
  });

  void it("keeps a bounded, instance-local context cache", () => {
    const first = createLoggerHarness();
    const second = createLoggerHarness();

    first.logger.log("one", "Shared");
    first.logger.log("two", "Shared");
    second.logger.log("three", "Shared");

    assert.deepStrictEqual(first.childBindings, [{ context: "Shared" }]);
    assert.deepStrictEqual(second.childBindings, [{ context: "Shared" }]);

    for (let index = 0; index <= 256; index += 1) {
      first.logger.log("bounded", `Context:${index}`);
    }
    first.logger.log("evicted", "Shared");

    assert.strictEqual(first.childBindings.length, 259);
  });

  void it("supports legacy custom-level Pino instances with a clear fallback", () => {
    const calls: string[] = [];
    const legacyInstance = {
      log() {
        calls.push("log");
      },
    };
    const logger = new Logger(legacyInstance as unknown as PinoLogger);

    logger.log("legacy");

    assert.deepStrictEqual(calls, ["log"]);
  });
});
