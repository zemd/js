import type { Logger as PinoLogger } from "pino";

import { Logger, type NestLogLevel } from "@zemd/nestjs-pino-logger";

export type PinoLogLevel = "debug" | "error" | "fatal" | "info" | "trace" | "warn";

export interface LogCall {
  readonly arguments: readonly unknown[];
  readonly bindings?: Readonly<Record<string, unknown>>;
  readonly level: PinoLogLevel;
}

export const LOG_LEVELS: readonly NestLogLevel[] = [
  "debug",
  "error",
  "fatal",
  "log",
  "verbose",
  "warn",
];

export const PINO_LEVEL_BY_NEST_LEVEL: Readonly<Record<NestLogLevel, PinoLogLevel>> = {
  debug: "debug",
  error: "error",
  fatal: "fatal",
  log: "info",
  verbose: "trace",
  warn: "warn",
};

const PINO_LEVELS = [
  "debug",
  "error",
  "fatal",
  "info",
  "trace",
  "warn",
] as const satisfies readonly PinoLogLevel[];

export const createLoggerHarness = (): {
  readonly childBindings: Array<Record<string, unknown>>;
  readonly calls: LogCall[];
  readonly logger: Logger;
} => {
  const childBindings: Array<Record<string, unknown>> = [];
  const calls: LogCall[] = [];

  const createMethods = (
    bindings?: Readonly<Record<string, unknown>>,
  ): Record<PinoLogLevel, (...arguments_: unknown[]) => void> => {
    return Object.fromEntries(
      PINO_LEVELS.map((level) => {
        return [
          level,
          (...arguments_: unknown[]): void => {
            calls.push({
              arguments: arguments_,
              ...(bindings === undefined ? {} : { bindings }),
              level,
            });
          },
        ];
      }),
    ) as Record<PinoLogLevel, (...arguments_: unknown[]) => void>;
  };

  const pinoInstance = {
    ...createMethods(),
    child(bindings: Record<string, unknown>) {
      childBindings.push(bindings);
      return createMethods(bindings);
    },
  };

  return {
    childBindings,
    calls,
    logger: new Logger(pinoInstance as unknown as PinoLogger),
  };
};

export const writeLog = (
  logger: Logger,
  level: NestLogLevel,
  message: unknown,
  optionalParameters: readonly unknown[],
): void => {
  logger[level](message, ...optionalParameters);
};
