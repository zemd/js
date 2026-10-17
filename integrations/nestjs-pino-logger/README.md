# NestJS logger powered by Pino

[![npm](https://img.shields.io/npm/v/@zemd/nestjs-pino-logger?color=0000ff&label=npm&labelColor=000)](https://npmjs.com/package/@zemd/nestjs-pino-logger)

`@zemd/nestjs-pino-logger` provides an ESM-only NestJS `LoggerService` backed
by Pino. It requires NestJS `^12.1.2`, Node.js 22.12 or newer, and Pino 10.
It uses Pino's standard levels:
`fatal`, `error`, `warn`, `info`, `debug`, and `trace`.

## Installation

```bash
pnpm add @zemd/nestjs-pino-logger @nestjs/common@^12.1.2 pino@^10
# or
npm install @zemd/nestjs-pino-logger @nestjs/common@^12.1.2 pino@^10
```

Install `pino-pretty` only when using the optional development transport:

```bash
pnpm add --save-dev pino-pretty
```

## Usage

Register the global module with direct Pino options or an asynchronous factory:

```typescript
// app.module.ts
import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { LoggerModule } from "@zemd/nestjs-pino-logger";
import type { LoggerOptions } from "pino";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService): LoggerOptions =>
        configService.getOrThrow<LoggerOptions>("pino"),
    }),
  ],
})
export class AppModule {}
```

```typescript
// main.ts
import { NestFactory } from "@nestjs/core";
import { Logger } from "@zemd/nestjs-pino-logger";
import { AppModule } from "./app.module";

const app = await NestFactory.create(AppModule, { bufferLogs: true });
app.useLogger(app.get(Logger));
await app.listen(3000);
```

`LoggerModule.forRoot(options)` is available when configuration is synchronous.
Logger calls follow NestJS 12 `ConsoleLogger` parameter parsing: a trailing string
is the context, and `error` and `fatal` accept a stack before the context or a
trailing stack trace. Plain objects after the first message are merged into a
`params` field on every emitted record; later objects override earlier keys.
Other optional values are emitted as separate Pino records in their original order.

```typescript
logger.log("Handled request", { requestId: "01JABC" }, "Application");
// One record with msg: "Handled request", params: { requestId: "01JABC" },
// and context: "Application".
```

When migrating from NestJS 11, update consumers that expected optional objects
to produce separate records, and include `params.*` paths in Pino redaction rules.
The first message object and `buildPinoMessage().mergingObject` still supply
top-level fields.

Use `formatLogMessage` when several values should become one formatted message.
It returns a string, so it works with this package and the default NestJS
logger:

```typescript
import { formatLogMessage } from "@zemd/nestjs-pino-logger";

logger.log(formatLogMessage("Handled request %s", requestId), "Application");
```

## Pretty transport

The optional subpath transport is intended for local development. It hides
structured fields, neutralizes terminal control characters, and respects
`colorize` and `singleLine`.

```typescript
import type { LoggerOptions } from "pino";

export const loggerOptions: LoggerOptions = {
  level: process.env.LOG_LEVEL ?? "info",
  transport:
    process.env.NODE_ENV === "production"
      ? undefined
      : {
          target: "@zemd/nestjs-pino-logger/pino-pretty-transport",
          options: {
            colorize: Boolean(process.stdout.isTTY),
            singleLine: false,
          },
        },
};
```

Use structured JSON without the pretty transport in production.

## Sensitive data and structured messages

Plain object messages remain structured, so Pino serializers and redaction run
before output:

```typescript
import type { LoggerOptions } from "pino";

export const loggerOptions: LoggerOptions = {
  redact: {
    paths: [
      "password",
      "*.password",
      "token",
      "*.token",
      "req.headers.authorization",
      "req.headers.cookie",
      'res.headers["set-cookie"]',
      "params.password",
      "params.token",
      "params.credentials.token",
    ],
    remove: true,
  },
};
```

Keep credentials and personal data in structured fields covered by redaction.
Do not pass secrets to `formatLogMessage`, interpolate them into another
message string, or place tokens in URL query parameters.

`buildPinoMessage` creates an immutable wrapper for a formatted message plus
structured fields:

```typescript
import { buildPinoMessage } from "@zemd/nestjs-pino-logger";

const message = buildPinoMessage({
  message: "Handled request %s",
  interpolationValues: ["01JABC"],
  mergingObject: { requestId: "01JABC" },
});

logger.log(message, "Application");
```

The input object is not modified. Redaction applies to `mergingObject`; values
placed directly in `message` or `interpolationValues` are intentionally part
of the rendered message. Plain objects passed after the structured message are
merged under `params`; other optional values are emitted as separate records.

## HTTP logging

HTTP logging remains separate. Install `pino-http` in the application and
reuse the registered standard Pino instance:

```typescript
import { Logger, PINO_LOGGER_INSTANCE } from "@zemd/nestjs-pino-logger";
import { NestFactory } from "@nestjs/core";
import pinoHttp from "pino-http";
import { AppModule } from "./app.module";

const app = await NestFactory.create(AppModule, { bufferLogs: true });
app.useLogger(app.get(Logger));
app.use(
  pinoHttp({
    logger: app.get(PINO_LOGGER_INSTANCE),
  }),
);
await app.listen(3000);
```

Configure Pino redaction and custom HTTP serializers before enabling request
fields beyond the safe defaults.

## Example

![NestJS Pino logger output](https://raw.githubusercontent.com/zemd/js/main/integrations/nestjs-pino-logger/example.png)

## License

`@zemd/nestjs-pino-logger` is released under the
[Blue Oak Model License 1.0.0](LICENSE.md).

## 💙 💛 Donate

[![Support Ukraine through UNITED24](https://img.shields.io/static/v1?label=UNITED24&message=support%20Ukraine&color=blue)](https://u24.gov.ua/)
