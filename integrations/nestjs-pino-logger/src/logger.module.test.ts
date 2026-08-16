import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { DynamicModule } from "@nestjs/common";
import {
  Logger,
  LoggerModule,
  PINO_LOGGER_INSTANCE,
  PINO_LOGGER_OPTIONS,
  customLevels,
} from "@zemd/nestjs-pino-logger";
import type { Logger as PinoLogger, LoggerOptions } from "pino";

type ProviderRecord = Record<PropertyKey, unknown>;

const findProvider = (dynamicModule: DynamicModule, token: unknown): ProviderRecord => {
  const provider = (dynamicModule.providers ?? []).find((candidate) => {
    return (
      candidate !== null &&
      typeof candidate === "object" &&
      "provide" in candidate &&
      candidate.provide === token
    );
  });

  assert.ok(provider && typeof provider === "object");
  return provider as unknown as ProviderRecord;
};

const getFactory = (provider: ProviderRecord): ((...arguments_: unknown[]) => unknown) => {
  const factory = provider["useFactory"];
  assert.strictEqual(typeof factory, "function");
  return factory as (...arguments_: unknown[]) => unknown;
};

void describe("LoggerModule", () => {
  void it("registers direct options, Logger, and a configured Pino instance", () => {
    const options = { level: "silent" } satisfies LoggerOptions;

    const dynamicModule = LoggerModule.forRoot(options);

    assert.strictEqual(dynamicModule.module, LoggerModule);
    assert.deepStrictEqual(customLevels, {
      fatal: 60,
      error: 50,
      warn: 40,
      log: 30,
      debug: 20,
      verbose: 10,
    });
    const optionsProvider = findProvider(dynamicModule, PINO_LOGGER_OPTIONS);
    assert.strictEqual(optionsProvider["useValue"], options);
    const pinoProvider = findProvider(dynamicModule, PINO_LOGGER_INSTANCE);
    assert.deepStrictEqual(pinoProvider["inject"], [PINO_LOGGER_OPTIONS]);
    const pinoInstance = getFactory(pinoProvider)(options) as PinoLogger;
    assert.strictEqual(pinoInstance.level, "silent");
    const logger = new Logger(pinoInstance);
    assert.doesNotThrow(() => {
      logger.log("log");
      logger.verbose("verbose");
      logger.fatal("fatal");
    });

    const exports = dynamicModule.exports as readonly unknown[];
    assert.ok(exports.includes(Logger));
    assert.ok(exports.includes(PINO_LOGGER_OPTIONS));
    assert.ok(exports.includes(PINO_LOGGER_INSTANCE));
  });

  void it("wires imports and injected asynchronous options into Pino", async () => {
    class ConfigModule {}
    class ExtraProvider {}
    const configToken = Symbol("config");
    const useFactory = async (level: string): Promise<LoggerOptions> => {
      return { level };
    };

    const dynamicModule = LoggerModule.forRootAsync({
      imports: [ConfigModule],
      extraProviders: [ExtraProvider],
      inject: [configToken],
      useFactory,
    });

    assert.deepStrictEqual(dynamicModule.imports, [ConfigModule]);
    assert.ok((dynamicModule.providers ?? []).includes(ExtraProvider));
    const optionsProvider = findProvider(dynamicModule, PINO_LOGGER_OPTIONS);
    assert.strictEqual(typeof optionsProvider["useFactory"], "function");
    assert.deepStrictEqual(optionsProvider["inject"], [configToken]);
    const resolvedOptions = await getFactory(optionsProvider)("fatal");
    assert.deepStrictEqual(resolvedOptions, { level: "fatal" });

    const pinoProvider = findProvider(dynamicModule, PINO_LOGGER_INSTANCE);
    assert.deepStrictEqual(pinoProvider["inject"], [PINO_LOGGER_OPTIONS]);
    const pinoInstance = getFactory(pinoProvider)(resolvedOptions) as PinoLogger;
    assert.strictEqual(pinoInstance.level, "fatal");

    const exports = dynamicModule.exports as readonly unknown[];
    assert.ok(exports.includes(Logger));
    assert.ok(exports.includes(PINO_LOGGER_OPTIONS));
    assert.ok(exports.includes(PINO_LOGGER_INSTANCE));
  });

  void it("defaults optional async imports and injections to empty arrays", () => {
    const dynamicModule = LoggerModule.forRootAsync({
      useFactory: () => {
        return { level: "silent" };
      },
    });

    assert.deepStrictEqual(dynamicModule.imports, []);
    assert.deepStrictEqual(findProvider(dynamicModule, PINO_LOGGER_OPTIONS)["inject"], []);
  });
});
