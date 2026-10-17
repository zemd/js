# Building block for Fetch API

This is a small, zero dependencies building block for creating HTTP clients based on native fetch api. It allows you to create native fetch-based API clients function easily and transparently.

## Installation

```sh
npm install @zemd/http-client
pnpm add @zemd/http-client
```

## Usage

```ts
import { HttpClient, RequestTransformer } from "@zemd/http-client";

const myfetch = HttpClient.make(
  [RequestTransformer.setMethod("POST"), RequestTransformer.jsonContentType()],
  fetch,
);
// ^ myfetch is a `fetch` function with configured http method and Content-Type
const resp = await myfetch("https://example.com");
// ^ calling `myfetch` is the same as calling `fetch` with the same arguments
```

As you can see the configuration and usage are very simple and straightforward.

Some real-world examples you can find in `../apis/` folder.

A simple example you can also find here [src/example.ts](./src/example.ts)

### Modules

Functionality is grouped into Effect-style namespaces. They use native fetch and promises
and require no Effect runtime. `HttpClient.make` applies transformers in the listed order and accepts
readonly arrays. Request option transforms copy the caller's `RequestInit` rather than mutating it.

| Module               | Operations                                                                               |
| -------------------- | ---------------------------------------------------------------------------------------- |
| `HttpClient`         | `make(transformers, client)`; `Type`, `Params`, and `Transformer` types                  |
| `Fetcher`            | `make(transformers, options, client)`; `isError`, `toLogRecord`; parsing and error types |
| `FetchMock`          | `fetch`, `register`, `clear`; `Pathname`, `Method`, and `Implementation` types           |
| `RequestTransformer` | `setMethod`, `appendHeader`, `jsonContentType`, `setBody`                                |
| `UrlTransformer`     | `prependPath`, `appendQuery`, `encodePathSegment`                                        |
| `Retry`              | `make(maxRetries, delay, backoffFactor, shouldRetry)`                                    |
| `Cache`              | `make(maxAge, maxEntries)`                                                               |
| `Debug`              | `make(logger)`; `RequestMetadata` and `Logger` types                                     |

`appendHeader` and `jsonContentType` append header values; they do not replace existing values.
`prependPath` prefixes an absolute URL's pathname, or the entire string for relative inputs.
`encodePathSegment` encodes a value for use in a pathname; it does not create a transformer.

Custom transformers use `HttpClient.Type`, `HttpClient.Params`, and `HttpClient.Transformer`.
Retry predicates use `Retry.ShouldRetry`. All original flat function exports and type names are
deprecated. They remain available as aliases for compatibility; use the
namespace API for new code. `createEndpoint` shares the richer errors and parsing controls
described below for `Fetcher.make`.

`HttpClient.ts` owns composition and fetch types. The `fetcher/` modules separate API client
creation from response parsing. The `mock/` modules separate fetch handling, registration,
and pathname matching. The original source entry points expose deprecated aliases for these implementations.

<details>
<summary>Migrating from the deprecated flat API</summary>

Replace flat imports with the corresponding namespace imports from `@zemd/http-client`.
Arguments, return types, and the shared mock registry are unchanged.

| Deprecated export                       | Replacement                          |
| --------------------------------------- | ------------------------------------ |
| `compose`                               | `HttpClient.make`                    |
| `createEndpoint`                        | `Fetcher.make`                       |
| `method`                                | `RequestTransformer.setMethod`       |
| `header`                                | `RequestTransformer.appendHeader`    |
| `json`                                  | `RequestTransformer.jsonContentType` |
| `body`                                  | `RequestTransformer.setBody`         |
| `prefix`                                | `UrlTransformer.prependPath`         |
| `query`                                 | `UrlTransformer.appendQuery`         |
| `pathSegment`                           | `UrlTransformer.encodePathSegment`   |
| `retry`                                 | `Retry.make`                         |
| `cache`                                 | `Cache.make`                         |
| `debug`                                 | `Debug.make`                         |
| `fetchMock`                             | `FetchMock.fetch`                    |
| `addEndpointMock`                       | `FetchMock.register`                 |
| `clearEndpointMocks`                    | `FetchMock.clear`                    |
| `Fetch`, `TFetchFn`                     | `HttpClient.Type`                    |
| `FetchParams`, `TFetchFnParams`         | `HttpClient.Params`                  |
| `FetchTransformer`, `TFetchTransformer` | `HttpClient.Transformer`             |
| `TShouldRetry`                          | `Retry.ShouldRetry`                  |
| `DebugRequest`                          | `Debug.RequestMetadata`              |
| `DebugLogger`                           | `Debug.Logger`                       |
| `TMockPathname`                         | `FetchMock.Pathname`                 |
| `TMockMethod`                           | `FetchMock.Method`                   |
| `TMockImplementation`                   | `FetchMock.Implementation`           |

</details>

### Creating API clients

```ts
import { Fetcher, RequestTransformer, UrlTransformer } from "@zemd/http-client";

const fetcher = Fetcher.make([UrlTransformer.prependPath("https://example.com")]);
const user = await fetcher<{ name: string }>("/users/1", [RequestTransformer.setMethod("GET")]);
```

`Fetcher.make` applies common transformers before per-request transformers and parses successful
responses as JSON by default. Both the transformer list and options on each request are optional:
`api<Result>(url, transformers?, options?)`. Request options override client defaults for that call.
Result types describe the expected data; they do not validate the response at runtime. Include any
fallback values from error handlers in the result type.

| `parseResponse`       | Behavior                                                                                                                        |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `"json"` (default)    | Decode JSON regardless of the declared content type; invalid JSON rejects with context.                                         |
| `"auto"`              | Decode `application/json` and `application/*+json` (including problem details); return text for other or missing content types. |
| `"text"`              | Return response text.                                                                                                           |
| `false`               | Return the original, unread `Response`. HTTP status checking still applies.                                                     |
| `(response) => value` | Use a custom decoder, synchronously or asynchronously, e.g. `response.arrayBuffer()`.                                           |

HEAD, 204, and 205 responses are returned unchanged without running a parser. Invalid JSON with a
JSON content type still rejects in `"auto"` mode. Empty JSON bodies on other responses also reject.

```ts
const fetcher = Fetcher.make([], { parseResponse: "auto" });
const result = await fetcher<{ name: string } | string>("https://example.com/users/1");

// Override the parser for an individual endpoint.
const bytes = await fetcher<ArrayBuffer>("https://example.com/export", [], {
  parseResponse: (response) => response.arrayBuffer(),
});

// Handle every HTTP status and the body yourself.
const response = await fetcher<Response>("https://example.com/status", [], {
  parseResponse: false,
  validateStatus: () => true,
});
```

<details>
<summary>Error details and handling</summary>

Unhandled failures reject with a native `Error` whose `cause` contains structured diagnostics.
`Fetcher.Error` is a TypeScript type, with `Fetcher.isError(error)` for narrowing unknown errors;
there is no custom Error constructor or subclass. For example, a server returning HTML where JSON
was expected produces a message containing the method, URL, status, expected parser, and received
content type. The response body is available separately, without being inserted into the message.

| Property in `error.cause`                                    | Information                                                                                                                             |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| `kind`                                                       | `"request"` for transport or transformer failures; `"http"` for rejected statuses; `"parse"` for body reading or decoding failures.     |
| `request`, `method`, `url`                                   | Last forwarded request URL and method; `url` prefers the final response URL when available.                                             |
| `response`, `status`, `statusText`, `headers`, `contentType` | Original response and snapshotted metadata, when received. Headers are a plain object with lowercase keys.                              |
| `body`, `rawBody`                                            | HTTP error body decoded as JSON or text, plus its original text. Built-in parsing failures retain any text read before decoding failed. |
| `originalError`                                              | Original request or parsing failure, including abort reasons, preserved by identity.                                                    |
| `bodyError`                                                  | An HTTP error body's read/JSON decoding failure, without hiding the HTTP status.                                                        |

HTTP error bodies are read from a clone, so `error.cause.response` remains unread. Successful-response
parsers consume the original body; on a parsing failure use `error.cause.rawBody` to inspect the captured text.
Custom parsers control body consumption and may fail without captured text. Request failures have
no response unless a response was already received, such as when `validateStatus` throws.

```ts
try {
  await api("https://example.com/users/1");
} catch (error) {
  if (Fetcher.isError(error)) {
    console.error(Fetcher.toLogRecord(error));
    // Inspect error.cause.body, error.cause.rawBody, and error.cause.originalError as needed.
  }
  throw error;
}
```

For structured logging, `Fetcher.toLogRecord(error)` returns plain JSON-safe fields with
`name`, `message`, `stack`, and `cause`. Both `JSON.stringify(error)` and
`JSON.stringify(error.cause)` also work through non-enumerable `toJSON` methods. Underlying native
errors retain their name, message, stack, nested causes, and enumerable fields such as `code`.
Circular references become `"[Circular]"`, bigint values become strings, and deeply nested values
are capped with `"[MaxDepth]"`. Unreadable objects become `"[Unserializable]"`.

The live `Response` is non-enumerable and excluded from logging; its metadata is already in the
cause. Serialization never reads its body or calls custom `toJSON` methods on thrown objects.
These records include captured response headers and bodies; choose which fields your logger emits.

```ts
const apiWithLogging = Fetcher.make([], {
  onError: (error) => {
    logger.error({ err: Fetcher.toLogRecord(error) }, "API request failed");
    // Returning undefined keeps the rejection.
  },
});
```

Use `onError` globally or per request to observe, replace, or recover from a failure. It runs once,
after transformers (including retries) finish, and async handlers are awaited. Returning `undefined`
preserves the rejection; any other value, including `null`, becomes the result. Throwing replaces
the error without wrapping it again. A per-request handler replaces the client handler;
`onError: null` disables it for that call.

```ts
const user = await api<{ name: string } | null>("https://example.com/users/1", [], {
  parseResponse: "json",
  onError: (error) => {
    if (error.cause.kind === "http" && error.cause.status === 404) return null;
    // Other failures still reject.
  },
});
```

`validateStatus(status, response)` controls which responses proceed to parsing and defaults to
`response.ok`. For example, `(status) => status < 500` accepts client-error responses for normal
parsing. Returning `false` produces an HTTP error, even for an otherwise successful status.

Transport and parsing failures are wrapped in native errors with a structured cause. Existing
handlers that check for native errors (including `AbortError`) should inspect `error.cause.originalError`
after narrowing with `Fetcher.isError`. HTTP errors retain `error.cause.response`. The deprecated
`createEndpoint` alias uses the same behavior.

</details>

### QUERY requests

Use `RequestTransformer.setMethod("QUERY")` with a serialized body and its content type.
[RFC 10008](https://www.rfc-editor.org/rfc/rfc10008.html) defines QUERY as a safe, idempotent
HTTP method whose request content describes the query to perform.

```ts
import { Fetcher, RequestTransformer, UrlTransformer } from "@zemd/http-client";

const fetcher = Fetcher.make([UrlTransformer.prependPath("https://example.com")]);
const users = await fetcher<Array<{ name: string }>>("/users", [
  RequestTransformer.setMethod("QUERY"),
  RequestTransformer.jsonContentType(),
  RequestTransformer.setBody(JSON.stringify({ name: "Ada" })),
]);
```

The same transformers work with `HttpClient.make`. `FetchMock.register(path, "QUERY", implementation)`
supports mocking these requests, including through the deprecated `addEndpointMock` alias.
`UrlTransformer.appendQuery` adds URL query parameters independently of the HTTP method.

### Safe paths and debugging

Use `UrlTransformer.encodePathSegment(value)` for every untrusted value inserted into a URL pathname. It accepts a
raw segment, rejects delimiters, controls, dot segments and pre-encoded input, then encodes the
value exactly once.

`Debug.make(logger)` reports request method, redacted URL and headers, and whether a body exists. It
never reports request bodies or raw values of authorization, cookie, token, key, password, or
secret fields.

### Retrying requests

`Retry.make(maxRetries, delay, backoffFactor, shouldRetry)` treats `maxRetries` as retries after
the initial request. By default it retries Fetch network failures and HTTP 5xx responses,
but not aborts, 4xx responses, or unrelated exceptions. `shouldRetry` receives the thrown
error (or a non-ok `Response`) and the one-based attempt number.

### Caching responses

`Cache.make(maxAge, maxEntries)` creates a bounded cache owned by that transformer. It caches GET
responses without consuming their bodies and returns response clones that retain the original
status, headers, and body. The key includes the URL, caller-supplied headers, credentials, mode,
and referrer settings. Failed responses, `Vary: *`, and responses with `Cache-Control: no-store`,
`Cache-Control: no-cache`, or `Cache-Control: private` are not stored.

QUERY requests bypass this cache because its keys do not include request bodies.

This is a small in-memory request cache, not a replacement for the browser HTTP cache. In
particular, browser-managed cookies are not visible in the cache key; do not use it for
user-specific responses unless the request carries an explicit differentiating header.

### Matching endpoint mocks

`FetchMock.register()` treats a string pathname as an exact value, including characters such as
`.` and `+`. Use an explicit `RegExp` when pattern matching is intended:

```ts
import { FetchMock } from "@zemd/http-client";

FetchMock.register("/users/profile", "GET", () => ({ exact: true }));
FetchMock.register(/\/users\/\d+/, "GET", () => ({ matched: true }));
```

Pass `FetchMock.fetch` as the client to `HttpClient.make` or `Fetcher.make`. Registrations are
shared across both namespace and compatibility APIs; use `FetchMock.clear()` between tests.
Mock implementations can return data, a `Response`, or a promise of either. Data is encoded as
JSON, while `Response` objects are returned unchanged. Implementation failures produce a 500
response, and missing registrations reject.

## License

`@zemd/http-client` released under the Apache 2.0 license

## Donate

[![](https://img.shields.io/static/v1?label=UNITED24&message=support%20Ukraine&color=blue)](https://u24.gov.ua/)
