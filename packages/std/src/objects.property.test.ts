import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  checkGetInvariants,
  checkMergeInvariants,
  type TObjectsModule,
} from "@zemd/properties/objects";
import * as objects from "./objects";

const contract: TObjectsModule = objects;

/**
 * Keys that historically trigger prototype pollution or property-shadowing bugs, weighted
 * far above random strings so that the interesting paths are actually reached.
 */
const hostileKey = fc.constantFrom(
  "__proto__",
  "constructor",
  "prototype",
  "toString",
  "valueOf",
  "hasOwnProperty",
  "length",
  "0",
  "",
);

const key = fc.oneof(
  { arbitrary: hostileKey, weight: 3 },
  { arbitrary: fc.string({ maxLength: 12 }), weight: 2 },
);

/**
 * `defineProperty` is used so that own `__proto__` properties are created, mirroring what
 * `JSON.parse` produces and what the fuzz target builds from raw bytes.
 */
const buildObject = (entries: [string, unknown][]): Record<string, unknown> => {
  const object: Record<string, unknown> = {};
  for (const [name, value] of entries) {
    Object.defineProperty(object, name, {
      value,
      enumerable: true,
      writable: true,
      configurable: true,
    });
  }
  return object;
};

const { object } = fc.letrec<{ value: unknown; object: Record<string, unknown> }>((tie) => {
  return {
    value: fc.oneof(
      { maxDepth: 3 },
      fc.constant(null),
      fc.boolean(),
      fc.integer(),
      fc.double(),
      fc.string({ maxLength: 12 }),
      fc.array(tie("value"), { maxLength: 4 }),
      tie("object"),
    ),
    object: fc.array(fc.tuple(key, tie("value")), { maxLength: 6 }).map(buildObject),
  };
});

const path = fc.oneof(
  fc.array(key, { minLength: 1, maxLength: 4 }).map((segments) => {
    return segments.join(".");
  }),
  fc.string({ maxLength: 24 }),
);

describe("objects properties", () => {
  it("should hold the get invariants for hostile objects and paths", () => {
    fc.assert(
      fc.property(object, path, (root, dotted) => {
        expect(checkGetInvariants(contract, root, dotted)).toEqual([]);
      }),
      { numRuns: 2000 },
    );
  });

  it("should hold the merge invariants for hostile inputs", () => {
    const inputs = fc.array(fc.option(object, { nil: undefined }), { maxLength: 4 });

    fc.assert(
      fc.property(inputs, (values) => {
        expect(checkMergeInvariants(contract, values)).toEqual([]);
      }),
      { numRuns: 2000 },
    );
  });
});
