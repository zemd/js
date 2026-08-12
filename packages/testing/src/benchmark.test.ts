import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  benchmark,
  formatBenchmarkResult,
  toBencherMetricFormat,
  type BenchmarkResult,
} from "./benchmark.ts";

void describe("benchmark", () => {
  void test("warms up a task and reports normalized batch statistics", () => {
    let calls = 0;
    const result = benchmark(
      "increment",
      () => {
        calls += 1;
      },
      {
        iterations: 500,
        samples: 3,
        warmupIterations: 7,
        budgetNanoseconds: 1_000_000,
      },
    );

    assert.strictEqual(calls, 1_507);
    assert.strictEqual(result.name, "increment");
    assert.strictEqual(result.iterations, 500);
    assert.strictEqual(result.samples, 3);
    assert.strictEqual(result.budgetNanoseconds, 1_000_000);
    assert.ok(Number.isFinite(result.meanNanoseconds));
    assert.ok(result.minNanoseconds > 0);
    assert.ok(result.minNanoseconds <= result.medianNanoseconds);
    assert.ok(result.medianNanoseconds <= result.maxNanoseconds);
    assert.ok(result.minNanoseconds <= result.meanNanoseconds);
    assert.ok(result.meanNanoseconds <= result.maxNanoseconds);
    assert.strictEqual(result.operationsPerSecond, 1_000_000_000 / result.meanNanoseconds);
    assert.ok(result.variationPercent !== null);
    assert.ok(Number.isFinite(result.variationPercent));
    assert.ok(result.variationPercent >= 0);
  });

  void test("bounds the default warmup by the measured iteration count", () => {
    let shortCalls = 0;
    benchmark(
      "short",
      () => {
        shortCalls += 1;
      },
      { iterations: 3, samples: 1 },
    );
    assert.strictEqual(shortCalls, 6);

    const singleSample = benchmark("single sample", () => undefined, {
      iterations: 3,
      samples: 1,
    });
    assert.strictEqual(singleSample.variationPercent, null);

    let longCalls = 0;
    benchmark(
      "long",
      () => {
        longCalls += 1;
      },
      { iterations: 1_001, samples: 1 },
    );
    assert.strictEqual(longCalls, 2_001);
  });

  void test("rejects invalid iteration options", () => {
    assert.throws(
      () => benchmark("invalid", () => undefined, { iterations: 0 }),
      /iterations must be a positive safe integer/,
    );
    assert.throws(
      () => benchmark("invalid", () => undefined, { iterations: 1, samples: 1.5 }),
      /samples must be a positive safe integer/,
    );
    assert.throws(
      () =>
        benchmark("invalid", () => undefined, {
          iterations: 1,
          warmupIterations: -1,
        }),
      /warmupIterations must be a non-negative safe integer/,
    );
    assert.throws(
      () => benchmark("invalid", () => undefined, { iterations: 1, budgetNanoseconds: 0 }),
      /budgetNanoseconds must be a positive finite number/,
    );
    assert.throws(
      () =>
        benchmark("invalid", () => undefined, {
          iterations: 1,
          budgetNanoseconds: Number.POSITIVE_INFINITY,
        }),
      /budgetNanoseconds must be a positive finite number/,
    );
  });

  void test("formats results for readable console tables", () => {
    const result: BenchmarkResult = {
      name: "parse",
      iterations: 100_000,
      samples: 5,
      meanNanoseconds: 97.49,
      medianNanoseconds: 1_025,
      minNanoseconds: 1_500_000,
      maxNanoseconds: 2_500_000_000,
      operationsPerSecond: 10_257_147.508_612_722,
      variationPercent: 3.245,
      budgetNanoseconds: 150,
    };

    assert.deepStrictEqual(formatBenchmarkResult(result), {
      name: "parse",
      iterations: "100,000",
      samples: 5,
      mean: "97.49 ns",
      median: "1.03 µs",
      min: "1.5 ms",
      max: "2.5 s",
      "ops/s": "10.26M",
      variation: "3.25%",
      budget: "150 ns",
      status: "within budget (35.01% headroom)",
    });
  });

  void test("describes performance relative to an optional budget", () => {
    const baseResult: BenchmarkResult = {
      name: "operation",
      iterations: 1_000,
      samples: 5,
      meanNanoseconds: 80,
      medianNanoseconds: 80,
      minNanoseconds: 75,
      maxNanoseconds: 85,
      operationsPerSecond: 12_500_000,
      variationPercent: 2,
    };

    assert.deepStrictEqual(
      {
        budget: formatBenchmarkResult(baseResult).budget,
        status: formatBenchmarkResult(baseResult).status,
        variation: formatBenchmarkResult({ ...baseResult, variationPercent: null }).variation,
      },
      { budget: "n/a", status: "not set", variation: "n/a" },
    );
    assert.strictEqual(
      formatBenchmarkResult({ ...baseResult, budgetNanoseconds: 100 }).status,
      "within budget (20% headroom)",
    );
    assert.strictEqual(
      formatBenchmarkResult({
        ...baseResult,
        meanNanoseconds: 95,
        budgetNanoseconds: 100,
      }).status,
      "near budget (5% headroom)",
    );
    assert.strictEqual(
      formatBenchmarkResult({
        ...baseResult,
        meanNanoseconds: 110,
        budgetNanoseconds: 100,
      }).status,
      "over budget (10% over)",
    );
  });

  void test("converts results to namespaced Bencher metrics", () => {
    const results: BenchmarkResult[] = [
      {
        name: "parse",
        iterations: 1_000,
        samples: 5,
        meanNanoseconds: 80,
        medianNanoseconds: 79,
        minNanoseconds: 75,
        maxNanoseconds: 85,
        operationsPerSecond: 12_500_000,
        variationPercent: 2,
      },
      {
        name: "stringify",
        iterations: 1_000,
        samples: 5,
        meanNanoseconds: 100,
        medianNanoseconds: 99,
        minNanoseconds: 95,
        maxNanoseconds: 105,
        operationsPerSecond: 10_000_000,
        variationPercent: 1.5,
      },
    ];

    assert.deepStrictEqual(toBencherMetricFormat(results, { namespace: "@zemd/example" }), {
      "@zemd/example/parse": {
        latency: { value: 80 },
        throughput: { value: 12_500_000 },
      },
      "@zemd/example/stringify": {
        latency: { value: 100 },
        throughput: { value: 10_000_000 },
      },
    });
  });

  void test("rejects invalid or duplicate Bencher benchmark names", () => {
    const result: BenchmarkResult = {
      name: "",
      iterations: 1,
      samples: 1,
      meanNanoseconds: 1,
      medianNanoseconds: 1,
      minNanoseconds: 1,
      maxNanoseconds: 1,
      operationsPerSecond: 1_000_000_000,
      variationPercent: null,
    };

    assert.throws(() => toBencherMetricFormat([result]), /names must not be empty/);
    assert.throws(
      () =>
        toBencherMetricFormat([
          { ...result, name: "same" },
          { ...result, name: "same" },
        ]),
      /Duplicate Bencher benchmark name: same/,
    );

    const prototypeName = toBencherMetricFormat([{ ...result, name: "__proto__" }]);
    assert.ok(Object.hasOwn(prototypeName, "__proto__"));
  });
});
