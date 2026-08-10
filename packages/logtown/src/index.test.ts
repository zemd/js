import assert from "node:assert/strict";
import { beforeEach, describe, mock, test } from "node:test";

import {
  createLogger,
  logger,
  registerWrapper,
  disableOutput,
  LOG_LEVELS,
  type LoggerWrapper,
  type LoggerPayload,
  LOGTOWN_RULES_SYMBOL,
} from "./index.ts";

const lastLog = (calls: readonly { readonly arguments: readonly unknown[] }[]): LoggerPayload => {
  const payload = calls.at(-1)?.arguments[0];
  assert.ok(payload && typeof payload === "object");
  return payload as LoggerPayload;
};

void describe("logtown", () => {
  beforeEach(() => {
    // Reset the global rules before each test
    (globalThis as any)[LOGTOWN_RULES_SYMBOL] = new Map();
  });

  void describe("createLogger", () => {
    void test("creates a new logger instance with given id", () => {
      const myLogger = createLogger("test-logger");
      assert.notStrictEqual(myLogger, undefined);
      assert.strictEqual(myLogger.id, "test-logger");
      assert.strictEqual(typeof myLogger.debug, "function");
      assert.strictEqual(typeof myLogger.info, "function");
      assert.strictEqual(typeof myLogger.warn, "function");
      assert.strictEqual(typeof myLogger.error, "function");
      assert.strictEqual(typeof myLogger.verbose, "function");
    });

    void test("returns the same instance for the same id", () => {
      const logger1 = createLogger("same-id");
      const logger2 = createLogger("same-id");
      assert.strictEqual(logger1, logger2);
    });
  });

  void describe("default logger", () => {
    void test("default logger is available", () => {
      assert.notStrictEqual(logger, undefined);
      assert.strictEqual(logger.id, "default");
      assert.strictEqual(typeof logger.debug, "function");
      assert.strictEqual(typeof logger.info, "function");
      assert.strictEqual(typeof logger.warn, "function");
      assert.strictEqual(typeof logger.error, "function");
      assert.strictEqual(typeof logger.verbose, "function");
    });
  });

  void describe("registerWrapper", () => {
    void test("registers function wrapper", () => {
      const mockWrapper = mock.fn();
      registerWrapper(mockWrapper);

      logger.info("test message");

      const payload = lastLog(mockWrapper.mock.calls);
      assert.partialDeepStrictEqual(payload, {
        level: "INFO",
        message: "test message",
        id: "default",
      });
      assert.strictEqual(typeof payload.timestamp, "number");
      assert.ok(Array.isArray(payload.data));
    });

    void test("registers object wrapper", () => {
      const info = mock.fn();
      const mockWrapper: LoggerWrapper = {
        verbose: mock.fn(),
        debug: mock.fn(),
        info,
        warn: mock.fn(),
        error: mock.fn(),
      };

      registerWrapper(mockWrapper);
      logger.info("test message");

      const payload = lastLog(info.mock.calls);
      assert.partialDeepStrictEqual(payload, {
        level: "INFO",
        message: "test message",
        id: "default",
      });
      assert.strictEqual(typeof payload.timestamp, "number");
      assert.ok(Array.isArray(payload.data));
    });
  });

  void describe("format strings", () => {
    void test("formats string with parameters", () => {
      const mockWrapper = mock.fn();
      registerWrapper(mockWrapper);

      logger.info("Hello, %s!", "world");

      const payload = lastLog(mockWrapper.mock.calls);
      assert.strictEqual(payload.message, "Hello, world!");
      assert.ok(payload.data.includes("world"));
    });

    void test("formats numbers", () => {
      const mockWrapper = mock.fn();
      registerWrapper(mockWrapper);

      logger.info("Number: %d", 42);

      const payload = lastLog(mockWrapper.mock.calls);
      assert.strictEqual(payload.message, "Number: 42");
      assert.ok(payload.data.includes(42));
    });

    void test("handles object messages", () => {
      const mockWrapper = mock.fn();
      registerWrapper(mockWrapper);

      const objWithMessage = { message: "test object message" };
      logger.info(objWithMessage);

      assert.strictEqual(lastLog(mockWrapper.mock.calls).message, "test object message");
    });

    void test("handles non-string messages", () => {
      const mockWrapper = mock.fn();
      registerWrapper(mockWrapper);

      logger.info(123, "extra", { foo: "bar" });

      assert.strictEqual(lastLog(mockWrapper.mock.calls).message, '123 "extra" {"foo":"bar"}');
    });
  });

  void describe("disableOutput", () => {
    void test("disables all logs for a module", () => {
      const mockWrapper = mock.fn();
      registerWrapper(mockWrapper);

      disableOutput(["test-module.*"]);
      const testLogger = createLogger("test-module");

      testLogger.info("This should not be logged");
      assert.strictEqual(mockWrapper.mock.callCount(), 0);
    });

    void test("disables specific level for a module", () => {
      const mockWrapper = mock.fn();
      registerWrapper(mockWrapper);

      disableOutput(["test-module.INFO"]);
      const testLogger = createLogger("test-module");

      testLogger.info("This should not be logged");
      testLogger.debug("This should be logged");

      assert.strictEqual(mockWrapper.mock.callCount(), 1);
      assert.strictEqual(lastLog(mockWrapper.mock.calls).level, "DEBUG");
    });

    void test("disables all logs for a dotted module id", () => {
      const mockWrapper = mock.fn();
      registerWrapper(mockWrapper);

      disableOutput(["app.db.*"]);
      const testLogger = createLogger("app.db");

      testLogger.info("This should not be logged");

      assert.strictEqual(mockWrapper.mock.callCount(), 0);
    });

    void test("normalizes lowercase rule levels", () => {
      const mockWrapper = mock.fn();
      registerWrapper(mockWrapper);

      disableOutput(["mymodule2.verbose"]);
      const testLogger = createLogger("mymodule2");

      testLogger.verbose("This should not be logged");
      testLogger.debug("This should be logged");

      assert.strictEqual(mockWrapper.mock.callCount(), 1);
      assert.strictEqual(lastLog(mockWrapper.mock.calls).level, "DEBUG");
    });

    void test("preserves exclamation marks inside module ids", () => {
      const mockWrapper = mock.fn();
      registerWrapper(mockWrapper);

      disableOutput(["test!module.*"]);

      createLogger("test!module").info("This should not be logged");
      createLogger("testmodule").info("This should be logged");

      assert.strictEqual(mockWrapper.mock.callCount(), 1);
      assert.strictEqual(lastLog(mockWrapper.mock.calls).id, "testmodule");
    });

    void test("handles negation rules", () => {
      const mockWrapper = mock.fn();
      registerWrapper(mockWrapper);

      disableOutput(["test-module.*", "!test-module.INFO"]);
      const testLogger = createLogger("test-module");

      testLogger.debug("This should not be logged");
      testLogger.info("This should be logged");

      assert.strictEqual(mockWrapper.mock.callCount(), 1);
      assert.strictEqual(lastLog(mockWrapper.mock.calls).level, "INFO");
    });

    void test("handles global level rules", () => {
      const mockWrapper = mock.fn();
      registerWrapper(mockWrapper);

      disableOutput(["*.INFO"]);
      const testLogger = createLogger("test-module");

      testLogger.info("This should not be logged");
      testLogger.debug("This should be logged");

      assert.strictEqual(mockWrapper.mock.callCount(), 1);
      assert.strictEqual(lastLog(mockWrapper.mock.calls).level, "DEBUG");
    });
  });

  void describe("log levels", () => {
    void test("all log levels are working", () => {
      const mockWrapper = mock.fn();
      registerWrapper(mockWrapper);

      LOG_LEVELS.forEach((level) => {
        const methodName = level.toLowerCase() as Lowercase<typeof level>;
        logger[methodName](`Test ${level}`);

        const payload = lastLog(mockWrapper.mock.calls);
        assert.partialDeepStrictEqual(payload, {
          level,
          message: `Test ${level}`,
          id: "default",
        });
        assert.strictEqual(typeof payload.timestamp, "number");
        assert.ok(Array.isArray(payload.data));
      });
    });
  });
});
