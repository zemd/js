import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  sign,
  clamp,
  clamp01,
  degreesToRadians,
  radiansToDegrees,
  pingPong,
  wrap,
  angleDeltaDegrees,
  angleDeltaRadians,
  normalize,
  nextPowerOfTwo,
  gcd,
} from "./math.ts";

void describe("sign", () => {
  void it("should return -1 for negative numbers", () => {
    assert.strictEqual(sign(-5), -1);
    assert.strictEqual(sign(-0.1), -1);
    assert.strictEqual(sign(-Infinity), -1);
  });

  void it("should return 1 for positive numbers", () => {
    assert.strictEqual(sign(5), 1);
    assert.strictEqual(sign(0.1), 1);
    assert.strictEqual(sign(Infinity), 1);
  });

  void it("should return 0 for zero", () => {
    assert.strictEqual(sign(0), 0);
    assert.strictEqual(sign(-0), 0);
  });
});

void describe("clamp", () => {
  void it("should return the value when within range", () => {
    assert.strictEqual(clamp(5, 0, 10), 5);
    assert.strictEqual(clamp(0, 0, 10), 0);
    assert.strictEqual(clamp(10, 0, 10), 10);
  });

  void it("should return min when value is below range", () => {
    assert.strictEqual(clamp(-5, 0, 10), 0);
    assert.strictEqual(clamp(-100, -50, 50), -50);
  });

  void it("should return max when value is above range", () => {
    assert.strictEqual(clamp(15, 0, 10), 10);
    assert.strictEqual(clamp(100, -50, 50), 50);
  });
});

void describe("clamp01", () => {
  void it("should clamp values between 0 and 1", () => {
    assert.strictEqual(clamp01(0.5), 0.5);
    assert.strictEqual(clamp01(-0.5), 0);
    assert.strictEqual(clamp01(1.5), 1);
    assert.strictEqual(clamp01(0), 0);
    assert.strictEqual(clamp01(1), 1);
  });
});

void describe("degToRad", () => {
  void it("should convert degrees to radians", () => {
    assert.strictEqual(degreesToRadians(0), 0);
    assert.ok(Math.abs(degreesToRadians(90) - Math.PI / 2) < 0.005);
    assert.ok(Math.abs(degreesToRadians(180) - Math.PI) < 0.005);
    assert.ok(Math.abs(degreesToRadians(360) - 2 * Math.PI) < 0.005);
    assert.ok(Math.abs(degreesToRadians(-90) - -Math.PI / 2) < 0.005);
  });
});

void describe("radToDeg", () => {
  void it("should convert radians to degrees", () => {
    assert.strictEqual(radiansToDegrees(0), 0);
    assert.ok(Math.abs(radiansToDegrees(Math.PI / 2) - 90) < 0.005);
    assert.ok(Math.abs(radiansToDegrees(Math.PI) - 180) < 0.005);
    assert.ok(Math.abs(radiansToDegrees(2 * Math.PI) - 360) < 0.005);
    assert.ok(Math.abs(radiansToDegrees(-Math.PI / 2) - -90) < 0.005);
  });
});

void describe("pingPong", () => {
  void it("should return correct values for triangle wave", () => {
    assert.strictEqual(pingPong(0, 1), 0);
    assert.strictEqual(pingPong(1, 1), 1);
    assert.strictEqual(pingPong(2, 1), 0);
    assert.strictEqual(pingPong(3, 1), 1);
    assert.strictEqual(pingPong(0.5, 1), 0.5);
    assert.strictEqual(pingPong(1.5, 1), 0.5);
  });

  void it("should handle different lengths", () => {
    assert.strictEqual(pingPong(0, 5), 0);
    assert.strictEqual(pingPong(5, 5), 5);
    assert.strictEqual(pingPong(10, 5), 0);
    assert.strictEqual(pingPong(7.5, 5), 2.5);
  });

  void it("should stay within [0, length] for negative values", () => {
    assert.strictEqual(pingPong(-1, 2), 1);
    assert.strictEqual(pingPong(-2, 2), 2);
    assert.strictEqual(pingPong(-3, 2), 1);
    assert.strictEqual(pingPong(-4, 2), 0);
    assert.strictEqual(pingPong(-0.5, 1), 0.5);
    assert.strictEqual(pingPong(Number.MIN_SAFE_INTEGER, 2), 1);
  });

  void it("should be symmetric around zero", () => {
    for (const x of [0.25, 1, 2.5, 3, 7.5]) {
      assert.strictEqual(pingPong(-x, 5), pingPong(x, 5));
    }
  });
});

void describe("wrap", () => {
  void it("should wrap values within range", () => {
    assert.strictEqual(wrap(5, 0, 3), 2);
    assert.strictEqual(wrap(-1, 0, 3), 2);
    assert.strictEqual(wrap(7, 2, 5), 4);
    assert.strictEqual(wrap(370, 0, 360), 10);
  });

  void it("should handle values within range", () => {
    assert.strictEqual(wrap(1, 0, 3), 1);
    assert.strictEqual(wrap(2.5, 2, 5), 2.5);
  });

  void it("should handle swapped parameters", () => {
    assert.strictEqual(wrap(5, 10, 0), 5);
    assert.strictEqual(wrap(-1, 3, 0), 2);
  });

  void it("should handle zero cycle", () => {
    assert.strictEqual(wrap(5, 2, 2), 2);
  });

  void it("should stay within range for extreme magnitudes", () => {
    const wrapped = wrap(-1.7976931347639577e308, 9.835850317439411e297, 0);
    assert.ok(wrapped >= 0);
    assert.ok(wrapped <= 9.835850317439411e297);
  });

  void it("should return the value when the range is wider than the double range", () => {
    assert.strictEqual(wrap(42, -1e308, 1e308), 42);
  });
});

void describe("angleDifferenceDegrees", () => {
  void it("should calculate angle differences in degrees", () => {
    assert.strictEqual(angleDeltaDegrees(0, 90), 90);
    assert.strictEqual(angleDeltaDegrees(0, 450), 90);
    assert.strictEqual(angleDeltaDegrees(350, 10), 20);
    assert.strictEqual(angleDeltaDegrees(10, 350), -20);
  });
});

void describe("angleDifferenceRadians", () => {
  void it("should calculate angle differences in radians", () => {
    assert.ok(Math.abs(angleDeltaRadians(0, Math.PI) - -Math.PI) < 0.005);
    assert.ok(Math.abs(angleDeltaRadians(0, 3 * Math.PI) - -Math.PI) < 0.005);
    assert.ok(Math.abs(angleDeltaRadians(0, Math.PI / 2) - Math.PI / 2) < 0.005);
  });
});

void describe("normalize", () => {
  void it("should normalize values to 0-1 range", () => {
    assert.strictEqual(normalize(5, 0, 10), 0.5);
    assert.strictEqual(normalize(0, 0, 10), 0);
    assert.strictEqual(normalize(10, 0, 10), 1);
    assert.strictEqual(normalize(-5, 0, 10), 0);
    assert.strictEqual(normalize(15, 0, 10), 1);
  });

  void it("should handle different ranges", () => {
    assert.strictEqual(normalize(7.5, 5, 10), 0.5);
    assert.strictEqual(normalize(0, -10, 10), 0.5);
  });
});

void describe("nextPowerOfTwo", () => {
  void it("should return correct powers of two", () => {
    assert.strictEqual(nextPowerOfTwo(1), 1);
    assert.strictEqual(nextPowerOfTwo(3), 4);
    assert.strictEqual(nextPowerOfTwo(8), 8);
    assert.strictEqual(nextPowerOfTwo(15), 16);
    assert.strictEqual(nextPowerOfTwo(17), 32);
    assert.strictEqual(nextPowerOfTwo(1000), 1024);
  });

  void it("should throw TypeError for non-safe integers", () => {
    assert.throws(() => {
      return nextPowerOfTwo(1.5);
    }, TypeError);
    assert.throws(() => {
      return nextPowerOfTwo(Number.NaN);
    }, TypeError);
    assert.throws(() => {
      return nextPowerOfTwo(Infinity);
    }, TypeError);
  });

  void it("should throw RangeError for non-positive values", () => {
    assert.throws(() => {
      return nextPowerOfTwo(0);
    }, RangeError);
    assert.throws(() => {
      return nextPowerOfTwo(-1);
    }, RangeError);
  });

  void it("should throw RangeError for values too large", () => {
    const maxSafePowerOfTwo = 1 << 30;
    assert.throws(() => {
      return nextPowerOfTwo(maxSafePowerOfTwo + 1);
    }, RangeError);
  });

  void it("should handle edge cases", () => {
    assert.strictEqual(nextPowerOfTwo(2), 2);
    assert.strictEqual(nextPowerOfTwo(4), 4);
    assert.strictEqual(nextPowerOfTwo(16), 16);
    assert.strictEqual(nextPowerOfTwo(1024), 1024);
  });
});

void describe("findGreatestCommonDivisor", () => {
  void it("should calculate GCD of positive integers", () => {
    assert.strictEqual(gcd(48, 18), 6);
    assert.strictEqual(gcd(12, 8), 4);
    assert.strictEqual(gcd(17, 13), 1);
    assert.strictEqual(gcd(100, 25), 25);
  });

  void it("should handle negative integers", () => {
    assert.strictEqual(gcd(-12, 8), 4);
    assert.strictEqual(gcd(12, -8), 4);
    assert.strictEqual(gcd(-12, -8), 4);
  });

  void it("should handle zero values", () => {
    assert.strictEqual(gcd(0, 5), 5);
    assert.strictEqual(gcd(5, 0), 5);
    assert.strictEqual(gcd(0, 0), 0);
  });

  void it("should handle edge cases", () => {
    assert.strictEqual(gcd(1, 1), 1);
    assert.strictEqual(gcd(1, 100), 1);
    assert.strictEqual(gcd(Number.MAX_SAFE_INTEGER, 1), 1);
  });

  void it("should throw TypeError for non-safe integers", () => {
    assert.throws(() => {
      return gcd(1.5, 2);
    }, TypeError);
    assert.throws(() => {
      return gcd(1, 2.5);
    }, TypeError);
    assert.throws(() => {
      return gcd(Number.MAX_SAFE_INTEGER + 1, 2);
    }, TypeError);
    assert.throws(() => {
      return gcd(Number.POSITIVE_INFINITY, 2);
    }, TypeError);
    assert.throws(() => {
      return gcd(Number.NaN, 2);
    }, TypeError);
  });
});
