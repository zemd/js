export const PinoMessageSymbol: unique symbol = Symbol.for("@zemd/nestjs-pino-logger/PinoMessage");
export const PINO_LOGGER_OPTIONS: unique symbol = Symbol.for("@zemd/nestjs-pino-logger/options");
export const PINO_LOGGER_INSTANCE: unique symbol = Symbol.for("@zemd/nestjs-pino-logger/instance");

/**
 * @deprecated The logger maps NestJS levels to Pino's standard levels. Custom
 * levels are no longer required and can break integrations that expect
 * `info`, `trace`, or `fatal`.
 */
export const customLevels: Readonly<{
  fatal: 60;
  error: 50;
  warn: 40;
  log: 30;
  debug: 20;
  verbose: 10;
}> = Object.freeze({
  fatal: 60,
  error: 50,
  warn: 40,
  log: 30,
  debug: 20,
  verbose: 10,
} as const);
