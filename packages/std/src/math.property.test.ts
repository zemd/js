import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  angleDeltaDegrees,
  clamp,
  clamp01,
  degreesToRadians,
  gcd,
  nextPowerOfTwo,
  normalize,
  pingPong,
  radiansToDegrees,
  sign,
  wrap,
} from "./math";

/**
 * Outside of this domain `nextPowerOfTwo` throws instead of returning a result.
 */
const POWER_OF_TWO_DOMAIN = { min: 1, max: 2 ** 30 };

/**
 * `fc.double()` already covers NaN, the infinities and subnormals; the constants are the
 * values the implementations special case, which random doubles almost never hit.
 */
const anyNumber = fc.oneof(
  { arbitrary: fc.double(), weight: 6 },
  { arbitrary: fc.integer(), weight: 3 },
  {
    arbitrary: fc.constantFrom(
      0,
      -0,
      1,
      -1,
      Number.EPSILON,
      Number.MAX_SAFE_INTEGER,
      Number.MIN_SAFE_INTEGER,
      Number.MAX_VALUE,
      Number.MIN_VALUE,
    ),
    weight: 1,
  },
);

const safeInteger = fc.integer({ min: Number.MIN_SAFE_INTEGER, max: Number.MAX_SAFE_INTEGER });

/**
 * Reducing a range is only exact while the offset from its start stays a safe integer, so
 * the cycle properties are stated over a magnitude that leaves room for the shift.
 */
const smallInteger = fc.integer({ min: -(2 ** 26), max: 2 ** 26 });

const finiteNumber = fc.double({ noNaN: true, noDefaultInfinity: true });

/**
 * The range invariants only hold up to double precision, so they are checked against the
 * representation error of the largest operand; a deviation within it is inherent to
 * IEEE-754 rather than a library defect.
 */
const tolerance = (...values: number[]): number => {
  return (
    Math.max(
      ...values.map((value) => {
        return Math.abs(value);
      }),
    ) * Number.EPSILON
  );
};

/**
 * Both `wrap` and `pingPong` reduce the input by whole cycles. That is only meaningful when
 * the offset from the range start and the cycle itself are representable; a range wider than
 * the double range, or one at the opposite end of it from the value, leaves nothing to
 * reduce.
 */
const isReducible = (value: number, from: number, cycle: number): boolean => {
  return Number.isFinite(value - from) && Number.isFinite(cycle) && cycle > 0;
};

const isPowerOfTwo = (value: number): boolean => {
  return value > 0 && (value & (value - 1)) === 0;
};

describe("sign", () => {
  it("should only ever answer -1, 0 or 1", () => {
    fc.assert(
      fc.property(anyNumber, (x) => {
        expect([-1, 0, 1]).toContain(sign(x));
      }),
      { numRuns: 2000 },
    );
  });

  it("should agree with the comparison it stands for", () => {
    fc.assert(
      fc.property(anyNumber, (x) => {
        const expected = x < 0 ? -1 : x > 0 ? 1 : 0;
        expect(sign(x)).toBe(expected);
      }),
      { numRuns: 2000 },
    );
  });

  it("should be odd around zero", () => {
    fc.assert(
      fc.property(anyNumber, (x) => {
        expect(sign(-x)).toBe(-sign(x) || 0);
      }),
      { numRuns: 2000 },
    );
  });
});

describe("clamp", () => {
  it("should never let the result escape a well ordered range", () => {
    fc.assert(
      fc.property(anyNumber, anyNumber, anyNumber, (x, a, b) => {
        fc.pre(Number.isFinite(x) && Number.isFinite(a) && Number.isFinite(b));
        const min = Math.min(a, b);
        const max = Math.max(a, b);

        const clamped = clamp(x, min, max);
        expect(clamped).toBeGreaterThanOrEqual(min);
        expect(clamped).toBeLessThanOrEqual(max);
      }),
      { numRuns: 5000 },
    );
  });

  it("should be idempotent", () => {
    fc.assert(
      fc.property(anyNumber, anyNumber, anyNumber, (x, a, b) => {
        const min = Math.min(a, b);
        const max = Math.max(a, b);

        const once = clamp(x, min, max);
        expect(clamp(once, min, max)).toBe(once);
      }),
      { numRuns: 5000 },
    );
  });

  it("should leave a value that is already inside the range untouched", () => {
    fc.assert(
      fc.property(anyNumber, anyNumber, anyNumber, (x, a, b) => {
        const min = Math.min(a, b);
        const max = Math.max(a, b);
        fc.pre(x >= min && x <= max);

        // Numeric equality: `Math.min`/`Math.max` normalize the sign of zero, which is
        // IEEE-754 rather than a defect.
        expect(clamp(x, min, max) === x).toBe(true);
      }),
      { numRuns: 5000 },
    );
  });

  it("should be what clamp01 restricts itself to", () => {
    fc.assert(
      fc.property(anyNumber, (x) => {
        expect(clamp01(x)).toBe(clamp(x, 0, 1));
      }),
      { numRuns: 2000 },
    );
  });
});

describe("wrap", () => {
  it("should keep the result inside the range whichever way the bounds are given", () => {
    fc.assert(
      fc.property(anyNumber, anyNumber, anyNumber, (x, from, to) => {
        const low = Math.min(from, to);
        const high = Math.max(from, to);
        fc.pre(isReducible(x, low, high - low));

        const epsilon = tolerance(x, low, high);
        for (const wrapped of [wrap(x, from, to), wrap(x, to, from)]) {
          expect(wrapped).toBeGreaterThanOrEqual(low - epsilon);
          expect(wrapped).toBeLessThanOrEqual(high + epsilon);
        }
      }),
      { numRuns: 5000 },
    );
  });

  it("should be unchanged by shifting the input a whole number of cycles", () => {
    const cycles = fc.integer({ min: -8, max: 8 });

    fc.assert(
      fc.property(smallInteger, smallInteger, smallInteger, cycles, (x, from, to, times) => {
        const cycle = Math.abs(to - from);
        fc.pre(cycle > 0);

        expect(wrap(x + times * cycle, from, to)).toBe(wrap(x, from, to));
      }),
      { numRuns: 5000 },
    );
  });

  it("should be idempotent", () => {
    fc.assert(
      fc.property(smallInteger, smallInteger, smallInteger, (x, from, to) => {
        const once = wrap(x, from, to);
        expect(wrap(once, from, to)).toBe(once);
      }),
      { numRuns: 5000 },
    );
  });

  it("should keep an angle delta within half a turn", () => {
    fc.assert(
      fc.property(finiteNumber, finiteNumber, (current, target) => {
        fc.pre(Number.isFinite(target - current));

        const delta = angleDeltaDegrees(current, target);
        expect(delta).toBeGreaterThanOrEqual(-180);
        expect(delta).toBeLessThanOrEqual(180);
      }),
      { numRuns: 5000 },
    );
  });
});

describe("pingPong", () => {
  it("should stay between zero and the length", () => {
    fc.assert(
      fc.property(anyNumber, anyNumber, (x, length) => {
        fc.pre(length > 0 && isReducible(x, 0, length * 2));

        const epsilon = tolerance(x, length);
        const pinged = pingPong(x, length);
        expect(pinged).toBeGreaterThanOrEqual(-epsilon);
        expect(pinged).toBeLessThanOrEqual(length + epsilon);
      }),
      { numRuns: 5000 },
    );
  });

  it("should be symmetric around zero", () => {
    const length = fc.integer({ min: 1, max: 2 ** 26 });

    fc.assert(
      fc.property(safeInteger, length, (x, size) => {
        fc.pre(Number.isSafeInteger(x + size * 2));

        expect(pingPong(-x, size)).toBe(pingPong(x, size));
      }),
      { numRuns: 5000 },
    );
  });
});

describe("normalize", () => {
  it("should never leave the unit interval", () => {
    fc.assert(
      fc.property(anyNumber, anyNumber, anyNumber, (value, from, to) => {
        const normalized = normalize(value, from, to);
        fc.pre(!Number.isNaN(normalized));

        expect(normalized).toBeGreaterThanOrEqual(0);
        expect(normalized).toBeLessThanOrEqual(1);
      }),
      { numRuns: 5000 },
    );
  });

  it("should pin the ends of the range to the ends of the interval", () => {
    fc.assert(
      fc.property(finiteNumber, finiteNumber, (from, to) => {
        fc.pre(from < to && Number.isFinite(to - from));

        expect(normalize(from, from, to)).toBe(0);
        expect(normalize(to, from, to)).toBe(1);
      }),
      { numRuns: 5000 },
    );
  });
});

describe("nextPowerOfTwo", () => {
  it("should answer the smallest power of two not below its input", () => {
    fc.assert(
      fc.property(fc.integer(POWER_OF_TWO_DOMAIN), (value) => {
        const result = nextPowerOfTwo(value);

        expect(isPowerOfTwo(result)).toBe(true);
        expect(result).toBeGreaterThanOrEqual(value);
        expect(result / 2).toBeLessThan(value);
      }),
      { numRuns: 5000 },
    );
  });

  it("should be idempotent", () => {
    fc.assert(
      fc.property(fc.integer(POWER_OF_TWO_DOMAIN), (value) => {
        const once = nextPowerOfTwo(value);
        expect(nextPowerOfTwo(once)).toBe(once);
      }),
      { numRuns: 5000 },
    );
  });

  it("should reject anything outside its domain instead of answering nonsense", () => {
    const outside = fc.oneof(
      fc.integer({ min: -(2 ** 31), max: 0 }),
      fc.integer({ min: POWER_OF_TWO_DOMAIN.max + 1, max: Number.MAX_SAFE_INTEGER }),
      fc.double().filter((value) => {
        return !Number.isSafeInteger(value);
      }),
    );

    fc.assert(
      fc.property(outside, (value) => {
        expect(() => {
          return nextPowerOfTwo(value);
        }).toThrow(Error);
      }),
      { numRuns: 2000 },
    );
  });
});

describe("gcd", () => {
  it("should answer a non negative common divisor", () => {
    fc.assert(
      fc.property(safeInteger, safeInteger, (a, b) => {
        const divisor = gcd(a, b);
        expect(divisor).toBeGreaterThanOrEqual(0);

        if (divisor === 0) {
          expect([a, b]).toEqual([0, 0]);
          return;
        }
        expect(a % divisor === 0).toBe(true);
        expect(b % divisor === 0).toBe(true);
      }),
      { numRuns: 5000 },
    );
  });

  it("should be commutative and blind to the sign of its arguments", () => {
    fc.assert(
      fc.property(safeInteger, safeInteger, (a, b) => {
        const divisor = gcd(a, b);

        expect(gcd(b, a)).toBe(divisor);
        expect(gcd(-a, b)).toBe(divisor);
        expect(gcd(a, -b)).toBe(divisor);
      }),
      { numRuns: 5000 },
    );
  });

  it("should be the greatest of the common divisors", () => {
    const factor = fc.integer({ min: 1, max: 2 ** 20 });

    fc.assert(
      fc.property(factor, factor, factor, (common, a, b) => {
        fc.pre(Number.isSafeInteger(common * a) && Number.isSafeInteger(common * b));

        expect(gcd(common * a, common * b)).toBeGreaterThanOrEqual(common);
      }),
      { numRuns: 5000 },
    );
  });

  it("should absorb a zero argument", () => {
    fc.assert(
      fc.property(safeInteger, (a) => {
        expect(gcd(a, 0)).toBe(Math.abs(a));
        expect(gcd(0, a)).toBe(Math.abs(a));
      }),
      { numRuns: 2000 },
    );
  });

  it("should reject arguments that are not safe integers", () => {
    const unsafe = fc.double().filter((value) => {
      return !Number.isSafeInteger(value);
    });

    fc.assert(
      fc.property(unsafe, safeInteger, (a, b) => {
        expect(() => {
          return gcd(a, b);
        }).toThrow(TypeError);
        expect(() => {
          return gcd(b, a);
        }).toThrow(TypeError);
      }),
      { numRuns: 2000 },
    );
  });
});

describe("angle conversion", () => {
  it("should round trip through radians", () => {
    fc.assert(
      fc.property(finiteNumber, (degrees) => {
        const radians = degreesToRadians(degrees);
        fc.pre(Number.isFinite(radians));

        const back = radiansToDegrees(radians);
        expect(Math.abs(back - degrees)).toBeLessThanOrEqual(
          Math.abs(degrees) * 1e-12 + Number.EPSILON,
        );
      }),
      { numRuns: 5000 },
    );
  });
});
