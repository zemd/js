import type { FuzzedDataProvider } from "@jazzer.js/core";
import { checkPrototypesIntact } from "@zemd/properties/objects";

/**
 * Keys that historically trigger prototype pollution or property-shadowing bugs.
 */
const HOSTILE_KEYS = [
  "__proto__",
  "constructor",
  "prototype",
  "toString",
  "valueOf",
  "hasOwnProperty",
  "length",
  "0",
  "",
] as const;

/**
 * Turns the invariant violations reported by `@zemd/properties` into a failure Jazzer.js
 * reports together with the input that produced it.
 */
export const assertNoViolations = (violations: string[]): void => {
  if (violations.length > 0) {
    throw new Error(`Invariant violated: ${violations.join("; ")}`);
  }
};

/**
 * Fails the fuzz run when the code under test leaked an attacker controlled key onto a
 * built-in prototype.
 */
export const assertPrototypesIntact = (context: string): void => {
  assertNoViolations(checkPrototypesIntact(context));
};

/**
 * Runs `fn` and swallows only the errors the API documents, so that findings reported by
 * Jazzer.js are limited to unexpected failures.
 */
export const ignoreExpected = (names: readonly string[], fn: () => void): void => {
  try {
    fn();
  } catch (error) {
    if (
      error instanceof Error &&
      (names.includes(error.name) || names.includes(error.constructor.name))
    ) {
      return;
    }
    throw error;
  }
};

export const consumeKey = (fdp: FuzzedDataProvider): string => {
  if (fdp.consumeBoolean()) {
    return HOSTILE_KEYS[fdp.consumeIntegralInRange(0, HOSTILE_KEYS.length - 1)] as string;
  }
  return fdp.consumeString(fdp.consumeIntegralInRange(0, 24));
};

const consumeScalar = (fdp: FuzzedDataProvider): unknown => {
  switch (fdp.consumeIntegralInRange(0, 4)) {
    case 0: {
      return null;
    }
    case 1: {
      return fdp.consumeBoolean();
    }
    case 2: {
      return fdp.consumeIntegral(4, true);
    }
    case 3: {
      return fdp.consumeNumber();
    }
    default: {
      return fdp.consumeString(fdp.consumeIntegralInRange(0, 32));
    }
  }
};

/**
 * Builds a JSON-like value from the fuzzer input. Depth is bounded so that findings come
 * from the library logic rather than from stack exhaustion on absurdly nested input.
 */
export const consumeValue = (fdp: FuzzedDataProvider, depth = 0): unknown => {
  if (depth >= 5 || fdp.remainingBytes < 4) {
    return consumeScalar(fdp);
  }

  switch (fdp.consumeIntegralInRange(0, 6)) {
    case 5: {
      const length = fdp.consumeIntegralInRange(0, 6);
      const array: unknown[] = [];
      for (let i = 0; i < length && fdp.remainingBytes > 0; i += 1) {
        array.push(consumeValue(fdp, depth + 1));
      }
      return array;
    }
    case 6: {
      return consumeObject(fdp, depth + 1);
    }
    default: {
      return consumeScalar(fdp);
    }
  }
};

/**
 * Builds an object whose keys may be hostile. `defineProperty` is used so that own
 * `__proto__` properties are created, mirroring what `JSON.parse` produces.
 */
export const consumeObject = (fdp: FuzzedDataProvider, depth = 0): Record<string, unknown> => {
  const object: Record<string, unknown> = {};
  const size = fdp.consumeIntegralInRange(0, 6);

  for (let i = 0; i < size && fdp.remainingBytes > 0; i += 1) {
    const key = consumeKey(fdp);
    Object.defineProperty(object, key, {
      value: consumeValue(fdp, depth),
      enumerable: true,
      writable: true,
      configurable: true,
    });
  }

  return object;
};
