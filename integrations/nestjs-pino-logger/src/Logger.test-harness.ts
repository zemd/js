import type { Logger as PinoLogger } from "pino";
import { ConsoleLogger, type LogLevel } from "@nestjs/common";

import { Logger, type NestLogLevel } from "@zemd/nestjs-pino-logger";
import type { ParsedNestLogCall } from "./nest-log-call.ts";

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

/** Capture the arguments produced by the installed NestJS public logging methods. */
export class ConsoleLoggerParser extends ConsoleLogger {
  private parsedCall: ParsedNestLogCall = {
    context: undefined,
    messages: [],
    params: undefined,
    stack: undefined,
  };

  constructor() {
    super({ logLevels: [...LOG_LEVELS] });
  }

  parseCall(
    level: LogLevel,
    message: unknown,
    optionalParameters: readonly unknown[],
  ): ParsedNestLogCall {
    this[level](message, ...optionalParameters);
    return this.parsedCall;
  }

  protected override printMessages(
    messages: unknown[],
    context?: string,
    _logLevel?: LogLevel,
    _writeStreamType?: "stdout" | "stderr",
    errorStack?: unknown,
    params?: Record<string, unknown>,
  ): void {
    this.parsedCall = {
      context,
      messages,
      params,
      stack: typeof errorStack === "string" ? errorStack : undefined,
    };
  }
}

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
