import { FuzzedDataProvider } from "@jazzer.js/core";
import {
  checkGcdInvariants,
  checkNextPowerOfTwoInvariants,
  checkRangeInvariants,
  type TMathModule,
} from "@zemd/properties/math";
import * as math from "@zemd/std-modules/math";
import { ignoreExpected, assertNoViolations } from "./helpers";

const contract: TMathModule = math;

const consumeNumber = (fdp: FuzzedDataProvider): number => {
  switch (fdp.consumeIntegralInRange(0, 7)) {
    case 0: {
      return Number.NaN;
    }
    case 1: {
      return Number.POSITIVE_INFINITY;
    }
    case 2: {
      return Number.NEGATIVE_INFINITY;
    }
    case 3: {
      return Number.MAX_SAFE_INTEGER;
    }
    case 4: {
      return Number.MIN_SAFE_INTEGER;
    }
    case 5: {
      return -0;
    }
    case 6: {
      return fdp.consumeIntegral(6, true);
    }
    default: {
      return fdp.consumeNumber();
    }
  }
};

/**
 * The invariants live in `@zemd/properties` so that the fast-check properties in
 * `packages/std` and this target cannot drift apart; only the input generation differs.
 */
export function fuzz(data: Buffer): void {
  const fdp = new FuzzedDataProvider(data);
  const x = consumeNumber(fdp);
  const min = consumeNumber(fdp);
  const max = consumeNumber(fdp);

  assertNoViolations(checkRangeInvariants(contract, x, min, max));

  math.degreesToRadians(x);
  math.radiansToDegrees(x);
  math.angleDeltaDegrees(x, min);
  math.angleDeltaRadians(x, min);

  // Unlike the property test, the fuzzer also reaches the inputs these two reject.
  const candidate = fdp.consumeIntegralInRange(-16, 2 ** 31);
  ignoreExpected(["TypeError", "RangeError"], () => {
    assertNoViolations(checkNextPowerOfTwoInvariants(contract, candidate));
  });

  const a = fdp.consumeIntegral(6, true);
  const b = fdp.consumeIntegral(6, true);
  ignoreExpected(["TypeError"], () => {
    assertNoViolations(checkGcdInvariants(contract, a, b));
  });
}
