# Building block for Fetch API

This is a small, zero dependencies building block for creating HTTP clients based on native fetch api. It allows you to compose your fetch function easily.

## Installation

```sh
npm install @zemd/http-client
pnpm add @zemd/http-client
```

## Usage

```ts
import { compose, method, json } from "@zemd/http-client";

const myfetch = compose([method("POST"), json()], fetch);
// ^ myfetch is a `fetch` function with configured http method and Content-Type
const resp = await myfetch("https://example.com");
// ^ calling `myfetch` is the same as calling `fetch` with the same arguments
```

As you can see the configuration and usage are very simple and straightforward.

Some real-world examples you can find in `../apis/` folder.

A simple example you can also find here [src/example.ts](./src/example.ts)

### Retrying requests

`retry(maxRetries, delay, backoffFactor, shouldRetry)` treats `maxRetries` as retries after
the initial request. By default it retries Fetch network failures and HTTP 5xx responses,
but not aborts, 4xx responses, or unrelated exceptions. `shouldRetry` receives the thrown
error (or a non-ok `Response`) and the one-based attempt number.

### Caching responses

`cache(maxAge, maxEntries)` creates a bounded cache owned by that transformer. It caches GET
responses without consuming their bodies and returns response clones that retain the original
status, headers, and body. The key includes the URL, caller-supplied headers, credentials, mode,
and referrer settings. Failed responses, `Vary: *`, and responses with `Cache-Control: no-store`,
`Cache-Control: no-cache`, or `Cache-Control: private` are not stored.

This is a small in-memory request cache, not a replacement for the browser HTTP cache. In
particular, browser-managed cookies are not visible in the cache key; do not use it for
user-specific responses unless the request carries an explicit differentiating header.

### Matching endpoint mocks

`addEndpointMock()` treats a string pathname as an exact value, including characters such as
`.` and `+`. Use an explicit `RegExp` when pattern matching is intended:

```ts
addEndpointMock("/users/profile", "GET", () => ({ exact: true }));
addEndpointMock(/\/users\/\d+/, "GET", () => ({ matched: true }));
```

## License

`@zemd/http-client` released under the Apache 2.0 license

## Donate

[![](https://img.shields.io/static/v1?label=UNITED24&message=support%20Ukraine&color=blue)](https://u24.gov.ua/)
