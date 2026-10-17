---
"@zemd/nestjs-pino-logger": major
---

Migrate to NestJS 12.1.2 and require Node.js 22.12 or newer. NestJS 11 is no longer supported.

Follow NestJS 12 logging semantics: merge optional plain objects into a `params` field on each record, and parse stack traces for both `error` and `fatal`. Applications should update log consumers and redaction paths for the nested parameters. Existing first-message objects and `buildPinoMessage` merging fields remain top-level.
