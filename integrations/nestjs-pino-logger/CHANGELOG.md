# @zemd/nestjs-pino-logger

## 3.0.0

### Major Changes

- Add Nest.js 12 support

- Migrate to NestJS 12.1.2 and require Node.js 22.12 or newer. NestJS 11 is no longer supported.

  Follow NestJS 12 logging semantics: merge optional plain objects into a `params` field on each record, and parse stack traces for both `error` and `fatal`. Applications should update log consumers and redaction paths for the nested parameters. Existing first-message objects and `buildPinoMessage` merging fields remain top-level.

### Patch Changes

- Update dependencies

## 2.0.0

### Major Changes

- Migrate the NestJS Pino logger to the zemd/js monorepo. Align it with standard
  Pino levels, preserve structured fields for serializers and redaction, and
  harden the optional pretty transport against terminal log injection. Match
  NestJS multi-message and error-parameter semantics, with `formatLogMessage` as
  the explicit opt-in helper for formatted single-message output.

## 1.2.0

### Minor Changes

- 965adb4: Repository maintenance

## 1.1.1

### Patch Changes

- a782804: distro files update

## 1.1.0

### Minor Changes

- 69b0eed: Update dependencies, repo maintenance
