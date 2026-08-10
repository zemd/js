import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { merge } from "./merge.ts";

void describe("Compatibility suite with deepmerge", () => {
  void test("add keys in target that do not exist at the root", () => {
    const src = { key1: "value1", key2: "value2" };
    const target = {};
    const res = merge(target, src);

    assert.deepStrictEqual(res, src);
    assert.deepStrictEqual(src, { key1: "value1", key2: "value2" });
    assert.deepStrictEqual(target, {});
  });

  void test("merge existing simple keys in target at the roots", () => {
    const src = { key1: "changed", key2: "value2" };
    const target = { key1: "value1", key3: "value3" };
    const expected = {
      key1: "changed",
      key2: "value2",
      key3: "value3",
    };

    assert.deepStrictEqual(target, { key1: "value1", key3: "value3" });
    assert.deepStrictEqual(merge(target, src), expected);
  });

  void test("merge nested objects into target", () => {
    const src = {
      key1: {
        subkey1: "changed",
        subkey3: "added",
      },
    };
    const target = {
      key1: {
        subkey1: "value1",
        subkey2: "value2",
      },
    };
    const expected = {
      key1: {
        subkey1: "changed",
        subkey2: "value2",
        subkey3: "added",
      },
    };

    assert.deepStrictEqual(target, {
      key1: {
        subkey1: "value1",
        subkey2: "value2",
      },
    });

    assert.deepStrictEqual(merge(target, src), expected);
  });

  void test("replace simple key with nested object in target", () => {
    const src = {
      key1: {
        subkey1: "subvalue1",
        subkey2: "subvalue2",
      },
    };
    const target = {
      key1: "value1",
      key2: "value2",
    };
    const expected = {
      key1: {
        subkey1: "subvalue1",
        subkey2: "subvalue2",
      },
      key2: "value2",
    };

    assert.deepStrictEqual(target, { key1: "value1", key2: "value2" });
    assert.deepStrictEqual(merge(target, src), expected);
  });

  void test("should add nested object in target", () => {
    const src = {
      b: {
        c: {},
      },
    };
    const target = {
      a: {},
    };
    const expected = {
      a: {},
      b: {
        c: {},
      },
    };

    assert.deepStrictEqual(merge(target, src), expected);
  });

  void test("should replace object with simple key in target", () => {
    const src = { key1: "value1" };
    const target = {
      key1: {
        subkey1: "subvalue1",
        subkey2: "subvalue2",
      },
      key2: "value2",
    };
    const expected = { key1: "value1", key2: "value2" };

    assert.deepStrictEqual(target, {
      key1: {
        subkey1: "subvalue1",
        subkey2: "subvalue2",
      },
      key2: "value2",
    });
    assert.deepStrictEqual(merge(target, src), expected);
  });

  void test("should replace objects with arrays", () => {
    const target = { key1: { subkey: "one" } };
    const src = { key1: ["subkey"] };
    const expected = { key1: ["subkey"] };

    assert.deepStrictEqual(merge(target, src), expected);
  });

  void test("should replace arrays with objects", () => {
    const target = { key1: ["subkey"] };
    const src = { key1: { subkey: "one" } };
    const expected = { key1: { subkey: "one" } };

    assert.deepStrictEqual(merge(target, src), expected);
  });

  void test("should replace dates with arrays", () => {
    const target = { key1: new Date() };
    const src = { key1: ["subkey"] };
    const expected = { key1: ["subkey"] };

    assert.deepStrictEqual(merge(target, src), expected);
  });

  void test("should replace null with arrays", () => {
    const target = {
      key1: null,
    };
    const src = {
      key1: ["subkey"],
    };
    const expected = {
      key1: ["subkey"],
    };

    assert.deepStrictEqual(merge(target, src), expected);
  });

  void test("should treat regular expressions like primitive values", () => {
    const target: Record<string, RegExp> = { key1: /abc/ };
    const src: Record<string, RegExp> = { key1: /efg/ };
    const expected: Record<string, RegExp> = { key1: /efg/ };

    assert.deepStrictEqual(merge(target, src), expected);
    assert.ok(merge<Record<"key1", RegExp>>(target, src).key1.test("efg"));
  });

  void test("should treat dates like primitives", () => {
    const monday = new Date("2016-09-27T01:08:12.761Z");
    const tuesday = new Date("2016-09-28T01:18:12.761Z");
    const target = {
      key: monday,
    };
    const source = {
      key: tuesday,
    };
    const expected = {
      key: tuesday,
    };
    const actual = merge<Record<"key", Date>>(target, source);

    assert.deepStrictEqual(actual, expected);
    assert.deepStrictEqual(actual.key.valueOf(), tuesday.valueOf());
  });

  void test("should overwrite values when property is initialised but undefined", () => {
    const target1 = { value: [] };
    const target2 = { value: null };
    const target3 = { value: 2 };

    const src = { value: undefined };

    function hasUndefinedProperty(o: { value: unknown }): void {
      assert.ok(Object.hasOwn(o, "value"));
      assert.strictEqual(typeof o.value, "undefined");
    }

    hasUndefinedProperty(merge(target1, src));
    hasUndefinedProperty(merge(target2, src));
    hasUndefinedProperty(merge(target3, src));
  });

  void test("should omit unsafe own keys at every merged object depth", () => {
    for (const unsafeKey of ["__proto__", "constructor", "prototype"] as const) {
      const hostile = Object.defineProperty({}, unsafeKey, {
        value: { polluted: true },
        enumerable: true,
        writable: true,
        configurable: true,
      }) as Record<string, unknown>;
      const nestedHostile = Object.defineProperty({ deeper: hostile }, unsafeKey, {
        value: { polluted: true },
        enumerable: true,
        writable: true,
        configurable: true,
      }) as Record<string, unknown>;
      const actual = merge<Record<string, unknown>>({ safe: 1 }, hostile, {
        nested: nestedHostile,
      });
      const nested = actual["nested"] as Record<string, unknown>;
      const deeper = nested["deeper"] as Record<string, unknown>;

      assert.strictEqual(Object.getPrototypeOf(actual), Object.prototype);
      assert.strictEqual(Object.getPrototypeOf(nested), Object.prototype);
      assert.strictEqual(Object.getPrototypeOf(deeper), Object.prototype);
      assert.strictEqual(
        Object.hasOwn(actual, unsafeKey),
        false,
        `root object must omit ${unsafeKey}`,
      );
      assert.strictEqual(
        Object.hasOwn(nested, unsafeKey),
        false,
        `nested object must omit ${unsafeKey}`,
      );
      assert.strictEqual(
        Object.hasOwn(deeper, unsafeKey),
        false,
        `deep object must omit ${unsafeKey}`,
      );
      assert.strictEqual(({} as Record<string, unknown>)["polluted"], undefined);
    }
  });

  void test("should reject a constructor.prototype pollution path", () => {
    const hostile = JSON.parse('{"constructor": {"prototype": {"polluted": true}}}') as Record<
      string,
      unknown
    >;
    const actual = merge<Record<string, unknown>>({ safe: 1 }, hostile);

    assert.deepStrictEqual(actual, { safe: 1 });
    assert.strictEqual(Object.hasOwn(actual, "constructor"), false);
    assert.strictEqual(({} as Record<string, unknown>)["polluted"], undefined);
  });

  void test("should ignore properties inherited from the prototype chain", () => {
    const base = { inherited: 1 };
    const input = Object.create(base) as Record<string, unknown>;
    input["own"] = 2;

    assert.deepStrictEqual(merge(input), { own: 2 });
  });
});
