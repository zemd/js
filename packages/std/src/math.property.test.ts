import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  checkGcdInvariants,
  checkNextPowerOfTwoInvariants,
  checkRangeInvariants,
  NEXT_POWER_OF_TWO_DOMAIN,
  type TMathModule,
} from "@zemd/properties/math";
import * as math from "./math";

const contract: TMathModule = math;

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

describe("math properties", () => {
  it("should hold the range invariants for arbitrary numbers", () => {
    fc.assert(
      fc.property(anyNumber, anyNumber, anyNumber, (x, min, max) => {
        expect(checkRangeInvariants(contract, x, min, max)).toEqual([]);
      }),
      { numRuns: 5000 },
    );
  });

  it("should hold the nextPowerOfTwo invariants across its domain", () => {
    fc.assert(
      fc.property(fc.integer(NEXT_POWER_OF_TWO_DOMAIN), (value) => {
        expect(checkNextPowerOfTwoInvariants(contract, value)).toEqual([]);
      }),
      { numRuns: 5000 },
    );
  });

  it("should hold the gcd invariants for safe integers", () => {
    const safeInteger = fc.integer({
      min: Number.MIN_SAFE_INTEGER,
      max: Number.MAX_SAFE_INTEGER,
    });

    fc.assert(
      fc.property(safeInteger, safeInteger, (a, b) => {
        expect(checkGcdInvariants(contract, a, b)).toEqual([]);
      }),
      { numRuns: 5000 },
    );
  });
});
