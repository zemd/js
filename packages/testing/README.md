# @zemd/testing

[![npm](https://img.shields.io/npm/v/@zemd/testing?color=0000ff&label=npm&labelColor=000)](https://npmjs.com/package/@zemd/testing)

Focused, dependency-free helpers for small gaps in Node.js 24's native testing and performance APIs. The package is ESM-only and requires Node.js 24 or newer.

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

`stubEnvironment` applies a group of environment changes and registers idempotent restoration with `context.after()`. Multiple calls restore in LIFO order, including keys that did not exist before the test. Calling an older restore function manually first unwinds newer stubs registered on the same context, preserving that order.

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

## Synchronous benchmarks

`benchmark` measures a synchronous task in repeated batches with `node:perf_hooks`. It performs an unmeasured warmup and reports mean, median, minimum, and maximum nanoseconds per task invocation. Operations per second are calculated from the mean.

```ts
import { benchmark, formatBenchmarkResult } from "@zemd/testing";

const input = '{"status":"ok"}';
let checksum = 0;
const result = benchmark(
  "JSON.parse",
  () => {
    const parsed = JSON.parse(input) as { status: string };
    checksum += parsed.status.length;
  },
  {
    iterations: 10_000,
    budgetNanoseconds: 1_000,
  },
);

if (checksum === 0) throw new Error("unexpected empty result");

console.table([formatBenchmarkResult(result)]);
```

`formatBenchmarkResult` keeps raw measurements separate from display formatting. It selects an appropriate duration unit, renders large throughput values compactly, and reports the coefficient of variation across measured batches. Lower variation means the batches were more consistent; a single-sample result reports `n/a` because variation cannot be estimated.

`toBencherMetricFormat` converts one or more raw results to [Bencher Metric Format](https://bencher.dev/docs/reference/bencher-metric-format/) JSON. Give each package a stable namespace so benchmarks from different packages cannot collide and the same benchmark name keeps one history across releases:

```ts
import { toBencherMetricFormat } from "@zemd/testing";

const metrics = toBencherMetricFormat([result], {
  namespace: "@acme/parser",
});

process.stdout.write(`${JSON.stringify(metrics)}\n`);
```

The resulting `latency` value is the mean nanoseconds per operation and `throughput` is operations per second. The transformer performs no file or network I/O; benchmark scripts decide whether to print the readable table or persist BMF JSON for CI.

When `budgetNanoseconds` is set, the formatted result describes the mean relative to that informational budget:

- `within budget` means the result has at least 10% headroom.
- `near budget` means the result has less than 10% headroom without exceeding the budget.
- `over budget` means the measured mean exceeded the budget.

The status does not throw or fail the benchmark. A budget is only meaningful when derived from the expected workload, and results should only be compared across equivalent runtime and machine conditions.

Each sample contains the configured number of iterations. The default is five samples and up to 1,000 warmup iterations. Use larger iteration counts for very fast tasks so timing the batch dominates the measurement overhead.

The task should consume its result or update an observable checksum when benchmarking otherwise-pure work. This prevents the runtime from discarding calculations whose results are unused.

The helper intentionally does not provide asynchronous measurement, automatic iteration calibration, result persistence, or performance thresholds. Benchmark timings vary by runtime and machine, so they should not be used as fixed-duration unit-test assertions.

For assertions, function spies, and existing object properties, prefer `node:assert` and the test context's native `context.mock.method()` or `context.mock.property()` APIs. `context.mock.property()` requires Node.js 24.3 or newer.

## License

`@zemd/testing` is released under the Apache 2.0 license.

## Donate

[![](https://img.shields.io/badge/patreon-donate-yellow.svg)](https://www.patreon.com/red_rabbit)
[![](https://img.shields.io/static/v1?label=UNITED24&message=support%20Ukraine&color=blue)](https://u24.gov.ua/)
