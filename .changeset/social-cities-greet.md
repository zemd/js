---
"@zemd/nestjs-pino-logger": major
---

Migrate the NestJS Pino logger to the zemd/js monorepo. Align it with standard
Pino levels, preserve structured fields for serializers and redaction, and
harden the optional pretty transport against terminal log injection. Match
NestJS multi-message and error-parameter semantics, with `formatLogMessage` as
the explicit opt-in helper for formatted single-message output.
