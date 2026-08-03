import fc from "fast-check";
import { afterEach, describe, expect, it } from "vitest";
import { builder, buildLicense, buildPathsObject, buildServerObject } from "./builders";
import { OpenSourceLicenses, type LicenseIdentifier } from "./licenses";
import type { ServerVariableObject } from "./types";

const PROTOTYPES: object[] = [Object.prototype, Array.prototype, Function.prototype];

const PRISTINE_KEYS: Set<string>[] = PROTOTYPES.map((proto) => {
  return new Set(Object.getOwnPropertyNames(proto));
});

/**
 * Reports keys the builders leaked onto a built-in prototype, and removes them so that a
 * single finding does not cascade into every later check.
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
 * Keys that historically trigger prototype pollution, weighted above random strings so that
 * the interesting paths are actually reached.
 */
const hostileKey = fc.constantFrom("__proto__", "constructor", "prototype", "toString", "valueOf");

const key = fc.oneof(
  { arbitrary: hostileKey, weight: 3 },
  { arbitrary: fc.string({ minLength: 1, maxLength: 12 }), weight: 2 },
);

/**
 * The builders clone through `structuredClone`, so the values stay within what it accepts.
 */
const jsonValue = fc.letrec<{ value: unknown }>((tie) => {
  return {
    value: fc.oneof(
      { maxDepth: 3 },
      fc.constant(null),
      fc.boolean(),
      fc.integer(),
      fc.string({ maxLength: 12 }),
      fc.array(tie("value"), { maxLength: 4 }),
      fc.dictionary(key, tie("value"), { maxKeys: 4 }),
    ),
  };
}).value;

const params = fc.dictionary(key, jsonValue, { maxKeys: 6 });

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

describe("builder", () => {
  it("should reproduce the object it was given", () => {
    fc.assert(
      fc.property(params, (input) => {
        expect(builder<Record<string, unknown>>(input).toJSON()).toEqual(input);
      }),
      { numRuns: 2000 },
    );
  });

  it("should keep its own prototype whatever keys it is given", () => {
    fc.assert(
      fc.property(params, (input) => {
        expect(Object.getPrototypeOf(builder<Record<string, unknown>>(input).toJSON())).toBe(
          Object.prototype,
        );
      }),
      { numRuns: 2000 },
    );
  });

  it("should never share a reference with the object it was given", () => {
    fc.assert(
      fc.property(params, (input) => {
        const inputReferences = collectReferences(input, new Set<object>());
        const result = builder<Record<string, unknown>>(input).toJSON();

        for (const reference of collectReferences(result, new Set<object>())) {
          expect(inputReferences.has(reference)).toBe(false);
        }
      }),
      { numRuns: 2000 },
    );
  });

  it("should answer the same object until something is set", () => {
    fc.assert(
      fc.property(params, (input) => {
        const instance = builder<Record<string, unknown>>(input);
        expect(instance.toJSON()).toBe(instance.toJSON());
      }),
      { numRuns: 2000 },
    );
  });

  it("should let the last write to a key win", () => {
    fc.assert(
      fc.property(params, key, jsonValue, (input, name, value) => {
        const result = builder<Record<string, unknown>>(input).set(name, value).toJSON();
        expect(result[name]).toEqual(value);
      }),
      { numRuns: 2000 },
    );
  });

  it("should flatten a nested builder into plain data", () => {
    fc.assert(
      fc.property(params, key, params, (input, name, nested) => {
        const result = builder<Record<string, unknown>>(input)
          .set(name, builder<Record<string, unknown>>(nested) as never)
          .toJSON();

        expect(result[name]).toEqual(nested);
      }),
      { numRuns: 2000 },
    );
  });
});

describe("buildServerObject", () => {
  const variables = fc.dictionary(
    fc.string({ minLength: 1, maxLength: 8 }).filter((name) => {
      return name !== "url" && name !== "description" && name !== "variables";
    }),
    fc.oneof(
      fc.string({ maxLength: 12 }),
      fc.record<ServerVariableObject>({ default: fc.string({ maxLength: 12 }) }),
    ),
    { maxKeys: 4 },
  );

  it("should keep the url it was given", () => {
    fc.assert(
      fc.property(fc.webUrl(), variables, (url, vars) => {
        expect(buildServerObject(url, vars).url).toBe(url);
      }),
      { numRuns: 2000 },
    );
  });

  it("should expand every variable into a server variable object", () => {
    fc.assert(
      fc.property(fc.webUrl(), variables, (url, vars) => {
        const built = buildServerObject(url, vars).variables ?? {};

        expect(Object.keys(built).sort()).toEqual(Object.keys(vars).sort());
        for (const [name, value] of Object.entries(vars)) {
          expect(built[name]).toEqual(typeof value === "string" ? { default: value } : value);
        }
      }),
      { numRuns: 2000 },
    );
  });

  it("should carry the specification extensions through", () => {
    const extensions = fc.dictionary(
      fc.string({ minLength: 1, maxLength: 8 }).map((name) => {
        return `x-${name}`;
      }),
      fc.string({ maxLength: 12 }),
      { maxKeys: 3 },
    );

    fc.assert(
      fc.property(fc.webUrl(), variables, extensions, (url, vars, extra) => {
        expect(buildServerObject(url, vars, extra)).toMatchObject(extra);
      }),
      { numRuns: 2000 },
    );
  });
});

describe("buildPathsObject", () => {
  const parameters = fc.dictionary(
    fc.string({ minLength: 1, maxLength: 8 }),
    fc.record({ in: fc.constantFrom("path" as const, "query" as const) }),
    { maxKeys: 4 },
  );

  it("should name every parameter after the key it was declared under", () => {
    const path = fc.string({ minLength: 1, maxLength: 16 }).map((segment) => {
      return `/${segment}` as const;
    });

    fc.assert(
      fc.property(path, parameters, (url, declared) => {
        const built = buildPathsObject(url, { parameters: declared });

        expect(Object.keys(built)).toEqual([url]);
        expect(built[url]?.parameters).toEqual(
          Object.entries(declared).map(([name, rest]) => {
            return { name, ...rest };
          }),
        );
      }),
      { numRuns: 2000 },
    );
  });
});

describe("buildLicense", () => {
  it("should answer the short name and the identifier of a known license", () => {
    const identifier = fc.constantFrom(...(Object.keys(OpenSourceLicenses) as LicenseIdentifier[]));

    fc.assert(
      fc.property(identifier, (id) => {
        expect(buildLicense(id)).toEqual({ name: OpenSourceLicenses[id].short, identifier: id });
      }),
    );
  });
});
