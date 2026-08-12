import { createHistogram, performance } from "node:perf_hooks";

const DEFAULT_SAMPLES = 5;
const MAX_DEFAULT_WARMUP_ITERATIONS = 1_000;
const NANOSECONDS_PER_SECOND = 1_000_000_000;
const NEAR_BUDGET_HEADROOM_PERCENT = 10;
const numberFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
const compactNumberFormatter = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 2,
});

export interface BenchmarkOptions {
  readonly iterations: number;
  readonly samples?: number;
  readonly warmupIterations?: number;
  readonly budgetNanoseconds?: number;
}

export interface BenchmarkResult {
  readonly name: string;
  readonly iterations: number;
  readonly samples: number;
  readonly meanNanoseconds: number;
  readonly medianNanoseconds: number;
  readonly minNanoseconds: number;
  readonly maxNanoseconds: number;
  readonly operationsPerSecond: number;
  readonly variationPercent: number | null;
  readonly budgetNanoseconds?: number;
}

export interface BencherMetric {
  readonly value: number;
}

export interface BencherBenchmarkMetrics {
  readonly latency: BencherMetric;
  readonly throughput: BencherMetric;
}

export type BencherMetricFormat = Readonly<Record<string, BencherBenchmarkMetrics>>;

export interface BencherMetricFormatOptions {
  readonly namespace?: string;
}

export interface FormattedBenchmarkResult {
  readonly name: string;
  readonly iterations: string;
  readonly samples: number;
  readonly mean: string;
  readonly median: string;
  readonly min: string;
  readonly max: string;
  readonly "ops/s": string;
  readonly variation: string;
  readonly budget: string;
  readonly status: string;
}

const assertSafeInteger = (name: string, value: number, minimum: number): void => {
  if (!Number.isSafeInteger(value) || value < minimum) {
    const range = minimum === 0 ? "non-negative" : "positive";
    throw new RangeError(`${name} must be a ${range} safe integer`);
  }
};

const assertPositiveFiniteNumber = (name: string, value: number): void => {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive finite number`);
  }
};

const formatNanoseconds = (nanoseconds: number): string => {
  if (nanoseconds < 1_000) {
    return `${numberFormatter.format(nanoseconds)} ns`;
  }
  if (nanoseconds < 1_000_000) {
    return `${numberFormatter.format(nanoseconds / 1_000)} µs`;
  }
  if (nanoseconds < NANOSECONDS_PER_SECOND) {
    return `${numberFormatter.format(nanoseconds / 1_000_000)} ms`;
  }
  return `${numberFormatter.format(nanoseconds / NANOSECONDS_PER_SECOND)} s`;
};

const formatBudgetStatus = (
  meanNanoseconds: number,
  budgetNanoseconds: number | undefined,
): Pick<FormattedBenchmarkResult, "budget" | "status"> => {
  if (budgetNanoseconds === undefined) {
    return { budget: "n/a", status: "not set" };
  }

  const headroomPercent = ((budgetNanoseconds - meanNanoseconds) / budgetNanoseconds) * 100;
  if (headroomPercent < 0) {
    return {
      budget: formatNanoseconds(budgetNanoseconds),
      status: `over budget (${numberFormatter.format(Math.abs(headroomPercent))}% over)`,
    };
  }
  if (headroomPercent < NEAR_BUDGET_HEADROOM_PERCENT) {
    return {
      budget: formatNanoseconds(budgetNanoseconds),
      status: `near budget (${numberFormatter.format(headroomPercent)}% headroom)`,
    };
  }
  return {
    budget: formatNanoseconds(budgetNanoseconds),
    status: `within budget (${numberFormatter.format(headroomPercent)}% headroom)`,
  };
};

/**
 * Formats a benchmark result for compact console tables while preserving the raw result.
 */
export const formatBenchmarkResult = (result: BenchmarkResult): FormattedBenchmarkResult => {
  const budgetStatus = formatBudgetStatus(result.meanNanoseconds, result.budgetNanoseconds);
  return {
    name: result.name,
    iterations: numberFormatter.format(result.iterations),
    samples: result.samples,
    mean: formatNanoseconds(result.meanNanoseconds),
    median: formatNanoseconds(result.medianNanoseconds),
    min: formatNanoseconds(result.minNanoseconds),
    max: formatNanoseconds(result.maxNanoseconds),
    "ops/s": compactNumberFormatter.format(result.operationsPerSecond),
    variation:
      result.variationPercent === null
        ? "n/a"
        : `${numberFormatter.format(result.variationPercent)}%`,
    ...budgetStatus,
  };
};

/**
 * Converts raw benchmark results to Bencher Metric Format without performing I/O.
 */
export const toBencherMetricFormat = (
  results: readonly BenchmarkResult[],
  options: BencherMetricFormatOptions = {},
): BencherMetricFormat => {
  const entries: Array<[string, BencherBenchmarkMetrics]> = [];
  const names = new Set<string>();

  for (const result of results) {
    const name = options.namespace ? `${options.namespace}/${result.name}` : result.name;
    if (name.length === 0) {
      throw new RangeError("Bencher benchmark names must not be empty");
    }
    if (names.has(name)) {
      throw new RangeError(`Duplicate Bencher benchmark name: ${name}`);
    }

    names.add(name);
    entries.push([
      name,
      {
        latency: { value: result.meanNanoseconds },
        throughput: { value: result.operationsPerSecond },
      },
    ]);
  }

  return Object.fromEntries(entries);
};

/**
 * Measures a synchronous task in repeated batches using Node.js performance histograms.
 */
export const benchmark = (
  name: string,
  task: () => unknown,
  options: BenchmarkOptions,
): BenchmarkResult => {
  const { budgetNanoseconds, iterations, samples = DEFAULT_SAMPLES } = options;
  const warmupIterations =
    options.warmupIterations ?? Math.min(iterations, MAX_DEFAULT_WARMUP_ITERATIONS);

  assertSafeInteger("iterations", iterations, 1);
  assertSafeInteger("samples", samples, 1);
  assertSafeInteger("warmupIterations", warmupIterations, 0);
  if (budgetNanoseconds !== undefined) {
    assertPositiveFiniteNumber("budgetNanoseconds", budgetNanoseconds);
  }

  for (let iteration = 0; iteration < warmupIterations; iteration += 1) {
    void task();
  }

  const histogram = createHistogram();
  const runSample = performance.timerify(
    () => {
      for (let iteration = 0; iteration < iterations; iteration += 1) {
        void task();
      }
    },
    { histogram },
  );

  for (let sample = 0; sample < samples; sample += 1) {
    runSample();
  }

  const meanNanoseconds = histogram.mean / iterations;
  const variationPercent = samples === 1 ? null : (histogram.stddev / histogram.mean) * 100;

  return {
    name,
    iterations,
    samples,
    meanNanoseconds,
    medianNanoseconds: Number(histogram.percentile(50)) / iterations,
    minNanoseconds: Number(histogram.min) / iterations,
    maxNanoseconds: Number(histogram.max) / iterations,
    operationsPerSecond: NANOSECONDS_PER_SECOND / meanNanoseconds,
    variationPercent,
    ...(budgetNanoseconds === undefined ? {} : { budgetNanoseconds }),
  };
};
