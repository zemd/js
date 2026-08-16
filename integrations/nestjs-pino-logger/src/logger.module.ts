import {
  type DynamicModule,
  type FactoryProvider,
  Global,
  type InjectionToken,
  Module,
  type ModuleMetadata,
  type OptionalFactoryDependency,
  type Provider,
  type ValueProvider,
} from "@nestjs/common";
import { Logger } from "./Logger";
import { PINO_LOGGER_INSTANCE, PINO_LOGGER_OPTIONS } from "./logger.constants";
import type { LoggerOptions } from "pino";
import pino from "pino";

export type LoggerOptionsFactory<TArguments extends unknown[] = unknown[]> = (
  ...arguments_: TArguments
) => Promise<LoggerOptions> | LoggerOptions;

export interface LoggerModuleAsyncOptions<TArguments extends unknown[] = unknown[]> extends Pick<
  ModuleMetadata,
  "imports"
> {
  readonly extraProviders?: readonly Provider[];
  readonly inject?: readonly (InjectionToken | OptionalFactoryDependency)[];
  readonly useFactory: LoggerOptionsFactory<TArguments>;
}

const createPinoLogger = (options: LoggerOptions) => {
  return pino(options);
};

@Global()
@Module({})
export class LoggerModule {
  static forRoot(options: LoggerOptions): DynamicModule {
    const loggerModuleOptions: ValueProvider<LoggerOptions> = {
      provide: PINO_LOGGER_OPTIONS,
      useValue: options,
    };

    const pinoProvider: FactoryProvider = {
      provide: PINO_LOGGER_INSTANCE,
      useFactory: createPinoLogger,
      inject: [PINO_LOGGER_OPTIONS],
    };

    return {
      module: LoggerModule,
      providers: [Logger, loggerModuleOptions, pinoProvider],
      exports: [Logger, PINO_LOGGER_OPTIONS, PINO_LOGGER_INSTANCE],
    };
  }

  static forRootAsync<TArguments extends unknown[]>(
    options: LoggerModuleAsyncOptions<TArguments>,
  ): DynamicModule {
    const optionsProvider: FactoryProvider<LoggerOptions> = {
      provide: PINO_LOGGER_OPTIONS,
      useFactory: (...arguments_: unknown[]) => {
        return options.useFactory(...(arguments_ as TArguments));
      },
      inject: [...(options.inject ?? [])],
    };

    const pinoProvider: FactoryProvider = {
      provide: PINO_LOGGER_INSTANCE,
      useFactory: createPinoLogger,
      inject: [PINO_LOGGER_OPTIONS],
    };

    return {
      module: LoggerModule,
      imports: options.imports ?? [],
      providers: [optionsProvider, pinoProvider, Logger, ...(options.extraProviders ?? [])],
      exports: [Logger, PINO_LOGGER_OPTIONS, PINO_LOGGER_INSTANCE],
    };
  }
}
