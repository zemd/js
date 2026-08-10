# @zemd/http-client

## 5.0.0

### Major Changes

- Preserve Request options during URL transforms, make retries policy-driven, cache full Response clones with bounded request-aware storage, and require explicit RegExp mock patterns.

## 4.1.0

### Minor Changes

- `method()` now rejects names that are not valid RFC 9110 tokens, throwing a `TypeError`
  instead of forwarding characters such as CR, LF or NUL into `RequestInit.method`. This
  closes a request smuggling vector for callers that build the method from untrusted input
  and pass the request to a custom `fetch` implementation that does not validate it itself.

## 4.0.7

### Patch Changes

- 9db831d: Update dependencies

## 4.0.6

### Patch Changes

- 66436da: avoid parsing response if no content status is sent

## 4.0.5

### Patch Changes

- f94f8c3: proper handling errors inside endpoint

## 4.0.4

### Patch Changes

- 44ca01c: use RegExp in mocks for matching pathnames

## 4.0.3

### Patch Changes

- 4e28929: add simple fetchMock implementation

## 4.0.2

### Patch Changes

- 9963098: pass fetchFn in createEndpoint parameters

## 4.0.1

### Patch Changes

- 00526be: fix build script

## 4.0.0

### Major Changes

- 0fd0294: Simplified new http-client, generate figma from openapi spec

## 3.0.1

### Patch Changes

- 4dfc2a3: improving debug transformer

## 3.0.0

### Major Changes

- 3772bdf: improving type safety for getting results instead Response, adding tests

## 2.0.0

### Major Changes

- 01691d6: Make it possible to map and validate response, and make typescript to highlight proper types

## 1.0.0

### Major Changes

- 0462a93: initial version
