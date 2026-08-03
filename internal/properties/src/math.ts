/**
 * The `@zemd/std-modules/math` surface under contract. It is declared structurally rather
 * than imported so that this package stays dependency free and the workspace graph acyclic.
 */
export type TMathModule = {
  sign: (x: number) => number;
  clamp: (x: number, min: number, max: number) => number;
  clamp01: (x: number) => number;
  wrap: (x: number, from: number, to: number) => number;
  normalize: (value: number, from: number, to: number) => number;
  pingPong: (x: number, length: number) => number;
  nextPowerOfTwo: (value: number) => number;
  gcd: (a: number, b: number) => number;
};

/**
 * Outside of this domain `nextPowerOfTwo` throws instead of returning a result, so the
 * invariants below only describe inputs within it.
 */
export const NEXT_POWER_OF_TWO_DOMAIN: { min: number; max: number } = { min: 1, max: 2 ** 30 };

/**
 * Range invariants only hold up to double precision, so they are checked against the
 * representation error of the largest operand; a deviation within it is inherent to
 * IEEE-754 rather than a library defect.
 */
const rangeTolerance = (...values: number[]): number => {
  const magnitude = Math.max(
    ...values.map((value) => {
      return Math.abs(value);
    }),
  );
  return magnitude * Number.EPSILON;
};

/**
 * Both `wrap` and `pingPong` reduce the input by whole cycles. That is only meaningful when
 * the offset from the range start and the cycle itself are representable; a range wider than
 * the double range, or one at the opposite end of it from the value, leaves nothing to
 * reduce.
 */
const isReducibleRange = (value: number, from: number, cycle: number): boolean => {
  return Number.isFinite(value - from) && Number.isFinite(cycle) && cycle > 0;
};

const isPowerOfTwo = (value: number): boolean => {
  return value > 0 && (value & (value - 1)) === 0;
};

/**
 * Invariants of the range reducing functions, for arbitrary numbers including NaN, the
 * infinities and negative zero. Every violated invariant is reported, so one run describes
 * everything that is broken instead of only the first failure.
 */
export const checkRangeInvariants = (
  math: TMathModule,
  x: number,
  min: number,
  max: number,
): string[] => {
  const violations: string[] = [];

  const signed = math.sign(x);
  if (![-1, 0, 1].includes(signed)) {
    violations.push(`sign(${x}) = ${signed} is not -1, 0 or 1`);
  }

  const clamped = math.clamp(x, min, max);
  if (Number.isFinite(x) && Number.isFinite(min) && Number.isFinite(max) && min <= max) {
    if (!(clamped >= min && clamped <= max)) {
      violations.push(`clamp(${x}, ${min}, ${max}) = ${clamped} escaped [${min}, ${max}]`);
    }
  }

  const clamped01 = math.clamp01(x);
  if (Number.isFinite(x) && !(clamped01 >= 0 && clamped01 <= 1)) {
    violations.push(`clamp01(${x}) = ${clamped01} escaped [0, 1]`);
  }

  const low = Math.min(min, max);
  const high = Math.max(min, max);
  const wrapped = math.wrap(x, min, max);
  if (isReducibleRange(x, low, high - low)) {
    const tolerance = rangeTolerance(x, low, high);
    if (!(wrapped >= low - tolerance && wrapped <= high + tolerance)) {
      violations.push(`wrap(${x}, ${min}, ${max}) = ${wrapped} escaped [${low}, ${high}]`);
    }
  }

  const normalized = math.normalize(x, min, max);
  if (Number.isFinite(x) && Number.isFinite(min) && Number.isFinite(max) && min !== max) {
    if (!Number.isNaN(normalized) && !(normalized >= 0 && normalized <= 1)) {
      violations.push(`normalize(${x}, ${min}, ${max}) = ${normalized} escaped [0, 1]`);
    }
  }

  const pinged = math.pingPong(x, min);
  if (min > 0 && isReducibleRange(x, 0, min * 2)) {
    const tolerance = rangeTolerance(x, min);
    if (!(pinged >= -tolerance && pinged <= min + tolerance)) {
      violations.push(`pingPong(${x}, ${min}) = ${pinged} escaped [0, ${min}]`);
    }
  }

  return violations;
};

/**
 * Invariants of `nextPowerOfTwo` for inputs inside {@link NEXT_POWER_OF_TWO_DOMAIN}.
 */
export const checkNextPowerOfTwoInvariants = (math: TMathModule, value: number): string[] => {
  const violations: string[] = [];
  const result = math.nextPowerOfTwo(value);

  if (!isPowerOfTwo(result)) {
    violations.push(`nextPowerOfTwo(${value}) = ${result} is not a power of two`);
  }
  if (result < value) {
    violations.push(`nextPowerOfTwo(${value}) = ${result} is smaller than its input`);
  }
  if (result >= value * 2 && value > 1) {
    violations.push(`nextPowerOfTwo(${value}) = ${result} is not the smallest such power`);
  }

  return violations;
};

/**
 * Invariants of `gcd` for safe integer inputs.
 */
export const checkGcdInvariants = (math: TMathModule, a: number, b: number): string[] => {
  const violations: string[] = [];
  const divisor = math.gcd(a, b);

  if (divisor < 0) {
    violations.push(`gcd(${a}, ${b}) = ${divisor} is negative`);
  }
  if (divisor > 0 && !(a % divisor === 0 && b % divisor === 0)) {
    violations.push(`gcd(${a}, ${b}) = ${divisor} does not divide both inputs`);
  }
  if (divisor === 0 && !(a === 0 && b === 0)) {
    violations.push(`gcd(${a}, ${b}) = 0 for a non zero input`);
  }

  return violations;
};
