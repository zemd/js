import fc from "fast-check";
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  ConsoleLoggerParser,
  createLoggerHarness,
  PINO_LEVEL_BY_NEST_LEVEL,
  writeLog,
} from "./Logger.test-harness.ts";
import { buildPinoMessage, formatLogMessage, PinoMessageSymbol } from "@zemd/nestjs-pino-logger";

const logLevel = fc.constantFrom("debug", "log", "verbose", "warn");
const logParameter = fc.oneof(fc.jsonValue(), fc.constant(undefined));
const logParameters = fc.array(logParameter, { maxLength: 5 });

const expectedPinoArguments = (
  message: unknown,
  params: Readonly<Record<string, unknown>> | undefined,
): readonly unknown[] => {
  if (message !== null && typeof message === "object") {
    return params === undefined ? [message] : [{ ...message, params }];
  }
  return params === undefined
    ? [formatLogMessage(message)]
    : [{ params }, formatLogMessage(message)];
};

void describe("Logger properties", () => {
  void it("routes arbitrary JSON-compatible calls without discarding parameters", () => {
    const oracle = new ConsoleLoggerParser();
    fc.assert(
      fc.property(
        logLevel,
        fc.jsonValue(),
        logParameters,
        fc.string({ maxLength: 64 }),
        (level, message, optionalParameters, loggerContext) => {
          const { childBindings, calls, logger } = createLoggerHarness();

          writeLog(logger, level, message, [...optionalParameters, loggerContext]);

          assert.deepStrictEqual(childBindings, [{ context: loggerContext }]);
          const { messages, params } = oracle.parseCall(level, message, [
            ...optionalParameters,
            loggerContext,
          ]);
          assert.strictEqual(calls.length, messages.length);
          for (const [index, nestMessage] of messages.entries()) {
            assert.strictEqual(calls[index]?.level, PINO_LEVEL_BY_NEST_LEVEL[level]);
            assert.deepStrictEqual(calls[index]?.bindings, { context: loggerContext });
            assert.deepStrictEqual(
              calls[index]?.arguments,
              expectedPinoArguments(nestMessage, params),
            );
          }
        },
      ),
      { numRuns: 1500 },
    );
  });

  void it("emits structured messages once without losing merging fields", () => {
    const oracle = new ConsoleLoggerParser();
    const mergingObject = fc.dictionary(fc.string({ maxLength: 32 }), fc.jsonValue(), {
      maxKeys: 8,
    });
    const interpolationValues = fc.option(fc.array(fc.jsonValue(), { maxLength: 5 }), {
      nil: undefined,
    });

    fc.assert(
      fc.property(
        fc.string({ maxLength: 128 }),
        interpolationValues,
        mergingObject,
        logParameters,
        fc.string({ maxLength: 64 }),
        (message, values, mergingFields, optionalParameters, loggerContext) => {
          const { calls, logger } = createLoggerHarness();
          const input = {
            message,
            mergingObject: mergingFields,
            ...(values === undefined ? {} : { interpolationValues: values }),
          };
          const structuredMessage = buildPinoMessage(input);

          logger.log(structuredMessage, ...optionalParameters, loggerContext);

          assert.notStrictEqual(structuredMessage, input);
          assert.strictEqual(Object.hasOwn(input, PinoMessageSymbol), false);
          assert.strictEqual(structuredMessage[PinoMessageSymbol], true);
          const { messages, params } = oracle.parseCall("log", structuredMessage, [
            ...optionalParameters,
            loggerContext,
          ]);
          assert.strictEqual(calls.length, messages.length);
          assert.strictEqual(calls[0]?.level, "info");
          assert.deepStrictEqual(calls[0]?.bindings, { context: loggerContext });
          const record = calls[0]?.arguments[0];
          assert.ok(record && typeof record === "object");
          assert.deepStrictEqual(record, {
            ...mergingFields,
            ...(params === undefined ? {} : { params }),
          });
          assert.strictEqual(Object.hasOwn(record, "formattedMsg"), false);
          assert.strictEqual(Object.hasOwn(record, PinoMessageSymbol), false);
          assert.strictEqual(calls[0]?.arguments[1], formatLogMessage(message, ...(values ?? [])));
          for (const [index, nestMessage] of messages.slice(1).entries()) {
            const call = calls[index + 1];
            assert.strictEqual(call?.level, "info");
            assert.deepStrictEqual(call?.bindings, { context: loggerContext });
            assert.deepStrictEqual(call?.arguments, expectedPinoArguments(nestMessage, params));
          }
        },
      ),
      { numRuns: 1500 },
    );
  });

  void it("creates at most one cached child for every repeated context", () => {
    fc.assert(
      fc.property(
        fc.array(fc.string({ maxLength: 32 }), { maxLength: 20 }),
        logLevel,
        (contexts, level) => {
          const { childBindings, logger } = createLoggerHarness();

          for (const loggerContext of contexts) {
            writeLog(logger, level, "message", [loggerContext]);
          }

          assert.deepStrictEqual(
            childBindings.map((bindings) => {
              return bindings["context"];
            }),
            [...new Set(contexts)],
          );
        },
      ),
      { numRuns: 750 },
    );
  });
});
