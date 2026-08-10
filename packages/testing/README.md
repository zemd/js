# @zemd/testing

[![npm](https://img.shields.io/npm/v/@zemd/testing?color=0000ff&label=npm&labelColor=000)](https://npmjs.com/package/@zemd/testing)

Focused, dependency-free helpers for small gaps in Node.js 24's native `node:test` runner. The package is ESM-only and requires Node.js 24 or newer.

## Installation

```sh
npm install --save-dev @zemd/testing
```

## Promise rejections

`getRejection` guarantees that a promise rejected and returns its reason for detailed assertions:

```ts
import assert from "node:assert/strict";
import { getRejection } from "@zemd/testing";

const error = await getRejection(request());
assert.ok(error instanceof Error);
assert.deepStrictEqual(error.cause, { status: 503 });
```

## Mock implementation sequences

Repeated calls to native `mockImplementationOnce()` target the same next call unless an invocation index is provided. `mockImplementationSequence` assigns consecutive implementations after any calls already recorded:

```ts
import assert from "node:assert/strict";
import { mock } from "node:test";
import { mockImplementationSequence } from "@zemd/testing";

const request = mock.fn(async () => "default");
mockImplementationSequence(request, [async () => "first", async () => "second"]);

assert.strictEqual(await request(), "first");
assert.strictEqual(await request(), "second");
assert.strictEqual(await request(), "default");
```

## Environment variables

`stubEnvironment` applies a group of environment changes and registers idempotent restoration with `context.after()`. Multiple calls restore in LIFO order, including keys that did not exist before the test.

```ts
import { test } from "node:test";
import { stubEnvironment } from "@zemd/testing";

test("uses a temporary endpoint", (context) => {
  stubEnvironment(context, { API_URL: "https://example.test" });
  // API_URL is restored automatically after the test.
});
```

Environment variables are process-wide state. Do not mutate the same keys from concurrent tests or subtests.

## Mock timers

`advanceTimersByTime` performs a bounded number of promise microtask turns before and after `MockTimers.tick()`. The default is one turn; pass the optional third argument when the code under test has a known deeper promise chain.

```ts
context.mock.timers.enable({ apis: ["setTimeout"] });
const result = retryRequest();

await advanceTimersByTime(context.mock.timers, 100, 2);
await result;
```

The helper does not attempt to detect when the microtask queue is empty. Keeping the bound explicit avoids nondeterministic or unbounded flushing.

For assertions, function spies, and existing object properties, prefer `node:assert` and the test context's native `context.mock.method()` or `context.mock.property()` APIs. `context.mock.property()` requires Node.js 24.3 or newer.

## License

`@zemd/testing` is released under the Apache 2.0 license.

## Donate

[![](https://img.shields.io/badge/patreon-donate-yellow.svg)](https://www.patreon.com/red_rabbit)
[![](https://img.shields.io/static/v1?label=UNITED24&message=support%20Ukraine&color=blue)](https://u24.gov.ua/)
