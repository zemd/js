import { Inject, Injectable, type LoggerService, type LogLevel } from "@nestjs/common";
import type { Logger as PinoLogger } from "pino";
import { PINO_LOGGER_INSTANCE, PinoMessageSymbol } from "./logger.constants";
import type { PinoMessage } from "./buildPinoMessage";
import { formatLogMessage } from "./formatLogMessage";
import { parseNestLogCall } from "./nest-log-call";

export type NestLogLevel = LogLevel;

type PinoLogLevel = "debug" | "error" | "fatal" | "info" | "trace" | "warn";
type LogMethod = (...arguments_: unknown[]) => void;

const MAX_CACHED_CONTEXTS = 256;

const pinoLevelByNestLevel: Readonly<Record<NestLogLevel, PinoLogLevel>> = {
  debug: "debug",
  error: "error",
  fatal: "fatal",
  log: "info",
  verbose: "trace",
  warn: "warn",
};

const isObject = (value: unknown): value is object => {
  return value !== null && typeof value === "object";
};

const isPinoMessage = (value: unknown): value is PinoMessage => {
  return isObject(value) && Reflect.get(value, PinoMessageSymbol) === true;
};

const createStackError = (message: string, stack: string) => {
  return { message, stack, type: "Error" };
};

@Injectable()
export class Logger implements LoggerService {
  private readonly childLoggers = new Map<string, PinoLogger>();
  private readonly pinoInstance: PinoLogger;

  constructor(@Inject(PINO_LOGGER_INSTANCE) pinoInstance: PinoLogger) {
    this.pinoInstance = pinoInstance;
  }

  debug(message: unknown, context?: string): void;
  debug(message: unknown, ...optionalParams: unknown[]): void;
  debug(message: unknown, ...optionalParams: unknown[]): void {
    this.doLog("debug", message, optionalParams);
  }

  error(message: unknown, stackOrContext?: string): void;
  error(message: unknown, stack?: string, context?: string): void;
  error(message: unknown, ...optionalParams: unknown[]): void;
  error(message: unknown, ...optionalParams: unknown[]): void {
    this.doLog("error", message, optionalParams);
  }

  fatal(message: unknown, context?: string): void;
  fatal(message: unknown, ...optionalParams: unknown[]): void;
  fatal(message: unknown, ...optionalParams: unknown[]): void {
    this.doLog("fatal", message, optionalParams);
  }

  log(message: unknown, context?: string): void;
  log(message: unknown, ...optionalParams: unknown[]): void;
  log(message: unknown, ...optionalParams: unknown[]): void {
    this.doLog("log", message, optionalParams);
  }

  verbose(message: unknown, context?: string): void;
  verbose(message: unknown, ...optionalParams: unknown[]): void;
  verbose(message: unknown, ...optionalParams: unknown[]): void {
    this.doLog("verbose", message, optionalParams);
  }

  warn(message: unknown, context?: string): void;
  warn(message: unknown, ...optionalParams: unknown[]): void;
  warn(message: unknown, ...optionalParams: unknown[]): void {
    this.doLog("warn", message, optionalParams);
  }

  private doLog(
    level: NestLogLevel,
    message: unknown,
    optionalParameters: readonly unknown[],
  ): void {
    const { context, messages, stack } = parseNestLogCall(level, message, optionalParameters);
    const instance = this.getPinoInstance(context);
    const log = this.getLogMethod(instance, level);

    for (const [index, nestMessage] of messages.entries()) {
      this.writeMessage(instance, log, nestMessage, index === 0 ? stack : undefined);
    }
  }

  private writeMessage(
    instance: PinoLogger,
    log: LogMethod,
    message: unknown,
    stack: string | undefined,
  ): void {
    if (isPinoMessage(message)) {
      const renderedMessage = formatLogMessage(
        message.message,
        ...(message.interpolationValues ?? []),
      );
      const record: Record<string, unknown> = {
        ...message.mergingObject,
        ...(stack === undefined ? {} : { err: createStackError(renderedMessage, stack) }),
      };
      log.call(instance, record, renderedMessage);
      return;
    }

    if (message instanceof Error) {
      const error =
        stack === undefined
          ? message
          : { message: message.message, stack, type: message.name || "Error" };
      log.call(instance, { err: error }, message.message);
      return;
    }

    if (isObject(message)) {
      if (stack === undefined) {
        log.call(instance, message);
      } else {
        log.call(instance, {
          ...message,
          err: createStackError("Logged error", stack),
        });
      }
      return;
    }

    const renderedMessage = formatLogMessage(message);
    if (stack !== undefined) {
      log.call(instance, { err: createStackError(renderedMessage, stack) }, renderedMessage);
      return;
    }

    log.call(instance, renderedMessage);
  }

  private getPinoInstance(context: string | undefined): PinoLogger {
    if (context === undefined) {
      return this.pinoInstance;
    }

    const cached = this.childLoggers.get(context);
    if (cached) {
      this.childLoggers.delete(context);
      this.childLoggers.set(context, cached);
      return cached;
    }

    const child = this.pinoInstance.child({ context });
    if (this.childLoggers.size >= MAX_CACHED_CONTEXTS) {
      const oldestContext = this.childLoggers.keys().next().value;
      if (oldestContext !== undefined) {
        this.childLoggers.delete(oldestContext);
      }
    }
    this.childLoggers.set(context, child);
    return child;
  }

  private getLogMethod(instance: PinoLogger, level: NestLogLevel): LogMethod {
    const pinoLevel = pinoLevelByNestLevel[level];
    const standardMethod = Reflect.get(instance, pinoLevel);
    if (typeof standardMethod === "function") {
      return standardMethod as LogMethod;
    }

    const legacyMethod = Reflect.get(instance, level);
    if (typeof legacyMethod === "function") {
      return legacyMethod as LogMethod;
    }

    throw new TypeError(
      `Pino logger does not expose the '${pinoLevel}' method required for NestJS '${level}' logs`,
    );
  }
}
