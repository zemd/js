import { describe, test, expect, vi, beforeEach } from "vitest";
import {
  createLogger,
  logger,
  registerWrapper,
  disableOutput,
  LOG_LEVELS,
  type LoggerWrapper,
  LOGTOWN_RULES_SYMBOL,
} from "./index.js";

describe("logtown", () => {
  beforeEach(() => {
    // Reset the global rules before each test
    (globalThis as any)[LOGTOWN_RULES_SYMBOL] = new Map();
  });

  describe("createLogger", () => {
    test("creates a new logger instance with given id", () => {
      const myLogger = createLogger("test-logger");
      expect(myLogger).toBeDefined();
      expect(myLogger.id).toBe("test-logger");
      expect(typeof myLogger.debug).toBe("function");
      expect(typeof myLogger.info).toBe("function");
      expect(typeof myLogger.warn).toBe("function");
      expect(typeof myLogger.error).toBe("function");
      expect(typeof myLogger.verbose).toBe("function");
    });

    test("returns the same instance for the same id", () => {
      const logger1 = createLogger("same-id");
      const logger2 = createLogger("same-id");
      expect(logger1).toBe(logger2);
    });
  });

  describe("default logger", () => {
    test("default logger is available", () => {
      expect(logger).toBeDefined();
      expect(logger.id).toBe("default");
      expect(typeof logger.debug).toBe("function");
      expect(typeof logger.info).toBe("function");
      expect(typeof logger.warn).toBe("function");
      expect(typeof logger.error).toBe("function");
      expect(typeof logger.verbose).toBe("function");
    });
  });

  describe("registerWrapper", () => {
    test("registers function wrapper", () => {
      const mockWrapper = vi.fn();
      registerWrapper(mockWrapper);

      logger.info("test message");

      expect(mockWrapper).toHaveBeenCalledWith(
        expect.objectContaining({
          level: "INFO",
          message: "test message",
          id: "default",
          timestamp: expect.any(Number),
          data: expect.any(Array),
        }),
      );
    });

    test("registers object wrapper", () => {
      const mockWrapper: LoggerWrapper = {
        verbose: vi.fn(),
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      };

      registerWrapper(mockWrapper);
      logger.info("test message");

      expect(mockWrapper.info).toHaveBeenCalledWith(
        expect.objectContaining({
          level: "INFO",
          message: "test message",
          id: "default",
          timestamp: expect.any(Number),
          data: expect.any(Array),
        }),
      );
    });
  });

  describe("format strings", () => {
    test("formats string with parameters", () => {
      const mockWrapper = vi.fn();
      registerWrapper(mockWrapper);

      logger.info("Hello, %s!", "world");

      expect(mockWrapper).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Hello, world!",
          data: expect.arrayContaining(["world"]),
        }),
      );
    });

    test("formats numbers", () => {
      const mockWrapper = vi.fn();
      registerWrapper(mockWrapper);

      logger.info("Number: %d", 42);

      expect(mockWrapper).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Number: 42",
          data: expect.arrayContaining([42]),
        }),
      );
    });

    test("handles object messages", () => {
      const mockWrapper = vi.fn();
      registerWrapper(mockWrapper);

      const objWithMessage = { message: "test object message" };
      logger.info(objWithMessage);

      expect(mockWrapper).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "test object message",
        }),
      );
    });

    test("handles non-string messages", () => {
      const mockWrapper = vi.fn();
      registerWrapper(mockWrapper);

      logger.info(123, "extra", { foo: "bar" });

      expect(mockWrapper).toHaveBeenCalledWith(
        expect.objectContaining({
          message: '123 "extra" {"foo":"bar"}',
        }),
      );
    });
  });

  describe("disableOutput", () => {
    test("disables all logs for a module", () => {
      const mockWrapper = vi.fn();
      registerWrapper(mockWrapper);

      disableOutput(["test-module.*"]);
      const testLogger = createLogger("test-module");

      testLogger.info("This should not be logged");
      expect(mockWrapper).not.toHaveBeenCalled();
    });

    test("disables specific level for a module", () => {
      const mockWrapper = vi.fn();
      registerWrapper(mockWrapper);

      disableOutput(["test-module.INFO"]);
      const testLogger = createLogger("test-module");

      testLogger.info("This should not be logged");
      testLogger.debug("This should be logged");

      expect(mockWrapper).toHaveBeenCalledTimes(1);
      expect(mockWrapper).toHaveBeenCalledWith(
        expect.objectContaining({
          level: "DEBUG",
        }),
      );
    });

    test("disables all logs for a dotted module id", () => {
      const mockWrapper = vi.fn();
      registerWrapper(mockWrapper);

      disableOutput(["app.db.*"]);
      const testLogger = createLogger("app.db");

      testLogger.info("This should not be logged");

      expect(mockWrapper).not.toHaveBeenCalled();
    });

    test("normalizes lowercase rule levels", () => {
      const mockWrapper = vi.fn();
      registerWrapper(mockWrapper);

      disableOutput(["mymodule2.verbose"]);
      const testLogger = createLogger("mymodule2");

      testLogger.verbose("This should not be logged");
      testLogger.debug("This should be logged");

      expect(mockWrapper).toHaveBeenCalledTimes(1);
      expect(mockWrapper).toHaveBeenCalledWith(
        expect.objectContaining({
          level: "DEBUG",
        }),
      );
    });

    test("preserves exclamation marks inside module ids", () => {
      const mockWrapper = vi.fn();
      registerWrapper(mockWrapper);

      disableOutput(["test!module.*"]);

      createLogger("test!module").info("This should not be logged");
      createLogger("testmodule").info("This should be logged");

      expect(mockWrapper).toHaveBeenCalledTimes(1);
      expect(mockWrapper).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "testmodule",
        }),
      );
    });

    test("handles negation rules", () => {
      const mockWrapper = vi.fn();
      registerWrapper(mockWrapper);

      disableOutput(["test-module.*", "!test-module.INFO"]);
      const testLogger = createLogger("test-module");

      testLogger.debug("This should not be logged");
      testLogger.info("This should be logged");

      expect(mockWrapper).toHaveBeenCalledTimes(1);
      expect(mockWrapper).toHaveBeenCalledWith(
        expect.objectContaining({
          level: "INFO",
        }),
      );
    });

    test("handles global level rules", () => {
      const mockWrapper = vi.fn();
      registerWrapper(mockWrapper);

      disableOutput(["*.INFO"]);
      const testLogger = createLogger("test-module");

      testLogger.info("This should not be logged");
      testLogger.debug("This should be logged");

      expect(mockWrapper).toHaveBeenCalledTimes(1);
      expect(mockWrapper).toHaveBeenCalledWith(
        expect.objectContaining({
          level: "DEBUG",
        }),
      );
    });
  });

  describe("log levels", () => {
    test("all log levels are working", () => {
      const mockWrapper = vi.fn();
      registerWrapper(mockWrapper);

      LOG_LEVELS.forEach((level) => {
        const methodName = level.toLowerCase() as Lowercase<typeof level>;
        logger[methodName](`Test ${level}`);

        expect(mockWrapper).toHaveBeenCalledWith(
          expect.objectContaining({
            level,
            message: `Test ${level}`,
            id: "default",
            timestamp: expect.any(Number),
            data: expect.any(Array),
          }),
        );
      });
    });
  });
});
