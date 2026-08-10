import fc from "fast-check";
import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { builder, buildLicense, buildPathsObject, buildServerObject } from "./builders.ts";
import { OpenSourceLicenses, type LicenseIdentifier } from "./licenses.ts";
import type { ServerVariableObject } from "./types.ts";

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
  assert.deepStrictEqual(leakedPrototypeKeys(), []);
});

void describe("builder", () => {
  void it("should reproduce the object it was given", () => {
    fc.assert(
      fc.property(params, (input) => {
        assert.deepStrictEqual(
          builder<Record<string, unknown>>(input).toJSON(),
          structuredClone(input),
        );
      }),
      { numRuns: 2000 },
    );
  });

  void it("should keep its own prototype whatever keys it is given", () => {
    fc.assert(
      fc.property(params, (input) => {
        assert.strictEqual(
          Object.getPrototypeOf(builder<Record<string, unknown>>(input).toJSON()),
          Object.prototype,
        );
      }),
      { numRuns: 2000 },
    );
  });

  void it("should never share a reference with the object it was given", () => {
    fc.assert(
      fc.property(params, (input) => {
        const inputReferences = collectReferences(input, new Set<object>());
        const result = builder<Record<string, unknown>>(input).toJSON();

        for (const reference of collectReferences(result, new Set<object>())) {
          assert.strictEqual(inputReferences.has(reference), false);
        }
      }),
      { numRuns: 2000 },
    );
  });

  void it("should answer the same object until something is set", () => {
    fc.assert(
      fc.property(params, (input) => {
        const instance = builder<Record<string, unknown>>(input);
        assert.strictEqual(instance.toJSON(), instance.toJSON());
      }),
      { numRuns: 2000 },
    );
  });

  void it("should let the last write to a key win", () => {
    fc.assert(
      fc.property(params, key, jsonValue, (input, name, value) => {
        const result = builder<Record<string, unknown>>(input).set(name, value).toJSON();
        assert.deepStrictEqual(result[name], structuredClone(value));
      }),
      { numRuns: 2000 },
    );
  });

  void it("should flatten a nested builder into plain data", () => {
    fc.assert(
      fc.property(params, key, params, (input, name, nested) => {
        const result = builder<Record<string, unknown>>(input)
          .set(name, builder<Record<string, unknown>>(nested) as never)
          .toJSON();

        assert.deepStrictEqual(result[name], structuredClone(nested));
      }),
      { numRuns: 2000 },
    );
  });
});

void describe("buildServerObject", () => {
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

  void it("should keep the url it was given", () => {
    fc.assert(
      fc.property(fc.webUrl(), variables, (url, vars) => {
        assert.strictEqual(buildServerObject(url, vars).url, url);
      }),
      { numRuns: 2000 },
    );
  });

  void it("should expand every variable into a server variable object", () => {
    fc.assert(
      fc.property(fc.webUrl(), variables, (url, vars) => {
        const built = buildServerObject(url, vars).variables ?? {};

        assert.deepStrictEqual(Object.keys(built).sort(), Object.keys(vars).sort());
        for (const [name, value] of Object.entries(vars)) {
          assert.deepStrictEqual(
            built[name],
            typeof value === "string" ? { default: value } : value,
          );
        }
      }),
      { numRuns: 2000 },
    );
  });

  void it("should carry the specification extensions through", () => {
    const extensions = fc.dictionary(
      fc.string({ minLength: 1, maxLength: 8 }).map((name) => {
        return `x-${name}`;
      }),
      fc.string({ maxLength: 12 }),
      { maxKeys: 3 },
    );

    fc.assert(
      fc.property(fc.webUrl(), variables, extensions, (url, vars, extra) => {
        assert.partialDeepStrictEqual(buildServerObject(url, vars, extra), extra);
      }),
      { numRuns: 2000 },
    );
  });
});

void describe("buildPathsObject", () => {
  const parameters = fc.dictionary(
    fc.string({ minLength: 1, maxLength: 8 }),
    fc.record({ in: fc.constantFrom("path" as const, "query" as const) }),
    { maxKeys: 4 },
  );

  void it("should name every parameter after the key it was declared under", () => {
    const path = fc.string({ minLength: 1, maxLength: 16 }).map((segment) => {
      return `/${segment}` as const;
    });

    fc.assert(
      fc.property(path, parameters, (url, declared) => {
        const built = buildPathsObject(url, { parameters: declared });

        assert.deepStrictEqual(Object.keys(built), [url]);
        assert.deepStrictEqual(
          built[url]?.parameters,
          Object.entries(declared).map(([name, rest]) => {
            return { name, ...rest };
          }),
        );
      }),
      { numRuns: 2000 },
    );
  });
});

void describe("buildLicense", () => {
  void it("should answer the short name and the identifier of a known license", () => {
    const identifier = fc.constantFrom(...(Object.keys(OpenSourceLicenses) as LicenseIdentifier[]));

    fc.assert(
      fc.property(identifier, (id) => {
        assert.deepStrictEqual(buildLicense(id), {
          name: OpenSourceLicenses[id].short,
          identifier: id,
        });
      }),
    );
  });
});
