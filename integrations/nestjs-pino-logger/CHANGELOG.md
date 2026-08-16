# @zemd/nestjs-pino-logger

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
