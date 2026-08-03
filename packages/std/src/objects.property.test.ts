import fc from "fast-check";
import { afterEach, describe, expect, it } from "vitest";
import { get, merge } from "./objects";

const PROTOTYPES: object[] = [Object.prototype, Array.prototype, Function.prototype];

const PRISTINE_KEYS: Set<string>[] = PROTOTYPES.map((proto) => {
  return new Set(Object.getOwnPropertyNames(proto));
});

/**
 * Reports keys the code under test leaked onto a built-in prototype, and removes them so
 * that a single finding does not cascade into every later check.
 */
const leakedPrototypeKeys = (): string[] => {
  const leaked: string[] = [];

  for (const [index, proto] of PROTOTYPES.entries()) {
    const pristine = PRISTINE_KEYS[index];
    for (const key of Object.getOwnPropertyNames(proto)) {
      if (!pristine?.has(key)) {
        delete (proto as Record<string, unknown>)[key];
        leaked.push(key);
      }
    }
  }

  return leaked;
};

/**
 * Keys that historically trigger prototype pollution or property shadowing bugs, weighted
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
 * `JSON.parse` produces rather than what an assignment would do.
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

/**
 * The traversal `get` is expected to perform: own properties only. Reaching an inherited
 * property would let a path such as `constructor.prototype` hand out a built-in object.
 */
const traverseOwn = (root: unknown, segments: string[]): unknown => {
  let current: unknown = root;

  for (const segment of segments) {
    if (current === null || current === undefined) {
      return null;
    }
    if (!Object.hasOwn(Object(current) as object, segment)) {
      return null;
    }
    current = (current as Record<string, unknown>)[segment];
  }

  return current ?? null;
};

const collectReferences = (value: unknown, seen: Set<object>, depth = 0): Set<object> => {
  if (depth > 8 || typeof value !== "object" || value === null || seen.has(value)) {
    return seen;
  }
  seen.add(value);

  for (const nested of Object.values(value)) {
    collectReferences(nested, seen, depth + 1);
  }

  return seen;
};

afterEach(() => {
  expect(leakedPrototypeKeys()).toEqual([]);
});

describe("get", () => {
  it("should read own properties only", () => {
    fc.assert(
      fc.property(object, path, (root, dotted) => {
        expect(get(root, dotted)).toStrictEqual(traverseOwn(root, dotted.split(".")));
      }),
      { numRuns: 5000 },
    );
  });

  it("should answer null rather than undefined for a missing path", () => {
    fc.assert(
      fc.property(object, path, (root, dotted) => {
        expect(get(root, dotted)).not.toBe(undefined);
      }),
      { numRuns: 5000 },
    );
  });

  it("should find every path built out of the keys of the object it is given", () => {
    const objectWithPath = object.chain((root) => {
      // A dotted path cannot address a key that itself contains a dot.
      const keys = Object.keys(root).filter((name) => {
        return name !== "" && !name.includes(".");
      });
      return keys.length === 0
        ? fc.constant<[Record<string, unknown>, string]>([root, ""])
        : fc.tuple(fc.constant(root), fc.constantFrom(...keys));
    });

    fc.assert(
      fc.property(objectWithPath, ([root, segment]) => {
        fc.pre(segment !== "" && root[segment] !== undefined && root[segment] !== null);

        expect(get(root, segment)).toStrictEqual(root[segment]);
      }),
      { numRuns: 5000 },
    );
  });

  it("should never leak a built-in prototype through a hostile path", () => {
    const hostilePath = fc.array(hostileKey, { minLength: 1, maxLength: 4 }).map((segments) => {
      return segments.join(".");
    });

    fc.assert(
      fc.property(object, hostilePath, (root, dotted) => {
        expect(PROTOTYPES).not.toContain(get(root, dotted));
      }),
      { numRuns: 5000 },
    );
  });

  it("should refuse a non object root", () => {
    const notAnObject = fc.oneof(
      fc.constant(null),
      fc.constant(undefined),
      fc.string(),
      fc.integer(),
      fc.boolean(),
    );

    fc.assert(
      fc.property(notAnObject, path, (root, dotted) => {
        expect(() => {
          return get(root as unknown as Record<string, unknown>, dotted);
        }).toThrow(TypeError);
      }),
      { numRuns: 2000 },
    );
  });
});

describe("merge", () => {
  const inputs = fc.array(fc.option(object, { nil: undefined }), { maxLength: 4 });

  it("should keep its own prototype whatever it is given", () => {
    fc.assert(
      fc.property(inputs, (values) => {
        expect(Object.getPrototypeOf(merge(...values))).toBe(Object.prototype);
      }),
      { numRuns: 5000 },
    );
  });

  it("should never share a reference with its inputs", () => {
    fc.assert(
      fc.property(inputs, (values) => {
        const inputReferences = new Set<object>();
        for (const value of values) {
          collectReferences(value, inputReferences);
        }

        const result = merge(...values);
        for (const reference of collectReferences(result, new Set<object>())) {
          expect(inputReferences.has(reference)).toBe(false);
        }
      }),
      { numRuns: 5000 },
    );
  });

  it("should never carry a __proto__ key into the result", () => {
    fc.assert(
      fc.property(inputs, (values) => {
        expect(Object.getOwnPropertyNames(merge(...values))).not.toContain("__proto__");
      }),
      { numRuns: 5000 },
    );
  });

  it("should leave its inputs untouched", () => {
    fc.assert(
      fc.property(inputs, (values) => {
        const before = values.map((value) => {
          return JSON.stringify(value);
        });

        merge(...values);

        expect(
          values.map((value) => {
            return JSON.stringify(value);
          }),
        ).toEqual(before);
      }),
      { numRuns: 5000 },
    );
  });

  it("should let the last input win on a conflicting key", () => {
    const conflicting = fc.tuple(key, fc.integer(), fc.integer()).map(([name, first, second]) => {
      return [buildObject([[name, first]]), buildObject([[name, second]]), name, second] as const;
    });

    fc.assert(
      fc.property(conflicting, ([first, second, name, winner]) => {
        fc.pre(name !== "__proto__");

        expect(merge(first, second)[name]).toBe(winner);
      }),
      { numRuns: 5000 },
    );
  });

  it("should ignore anything that is not a plain object", () => {
    const ignored = fc.oneof(
      fc.constant(null),
      fc.constant(undefined),
      fc.array(fc.integer(), { maxLength: 4 }),
    );

    fc.assert(
      fc.property(object, fc.array(ignored, { maxLength: 3 }), (root, noise) => {
        expect(merge(root, ...(noise as (Record<string, unknown> | null | undefined)[]))).toEqual(
          merge(root),
        );
      }),
      { numRuns: 5000 },
    );
  });

  it("should be idempotent when merged with itself", () => {
    fc.assert(
      fc.property(object, (root) => {
        const once = merge(root);
        expect(merge(once, root)).toEqual(once);
      }),
      { numRuns: 5000 },
    );
  });
});
