import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { get } from "./get.ts";

void describe("get function", () => {
  // Test basic object property access
  void it("should get a property from an object", () => {
    const obj = { name: "John", age: 30 };
    assert.strictEqual(get(obj, "name"), "John");
    assert.strictEqual(get(obj, "age"), 30);
  });

  // Test nested object property access
  void it("should get a nested property from an object", () => {
    const obj = {
      user: {
        name: "John",
        details: {
          age: 30,
          address: { city: "New York" },
        },
      },
    };
    assert.strictEqual(get(obj, "user.name"), "John");
    assert.strictEqual(get(obj, "user.details.age"), 30);
    assert.strictEqual(get(obj, "user.details.address.city"), "New York");
  });

  // Test with non-existent properties
  void it("should return null for non-existent properties", () => {
    const obj = { name: "John", age: 30 };
    assert.strictEqual(get(obj, "address"), null);
    assert.strictEqual(get(obj, "job.title"), null);
  });

  // Test with null/undefined values
  void it("should return null for paths that lead to null/undefined values", () => {
    const obj = {
      name: "John",
      details: null,
      settings: {
        notifications: undefined,
      },
    };
    assert.strictEqual(get(obj, "details"), null);
    assert.strictEqual(get(obj, "details.prop"), null);
    assert.strictEqual(get(obj, "settings.notifications"), null);
  });

  // Test with non-object argument
  void it("should throw TypeError when first argument is not an object", () => {
    assert.throws(() => {
      return get("not an object" as any, "property");
    }, TypeError);
    assert.throws(() => {
      return get(42 as any, "property");
    }, TypeError);
    assert.throws(() => {
      return get(null as any, "property");
    }, TypeError);
    assert.throws(() => {
      return get(undefined as any, "property");
    }, TypeError);
  });

  // Test TypeScript type inference with a more complex example
  void it("should properly handle complex nested types", () => {
    interface User {
      id: number;
      name: string;
      settings: {
        theme: "light" | "dark";
        notifications: boolean;
        preferences: {
          language: string;
        };
      };
    }

    const user: User = {
      id: 1,
      name: "John",
      settings: {
        theme: "dark",
        notifications: true,
        preferences: {
          language: "en",
        },
      },
    };

    const theme = get(user, "settings.theme");
    assert.strictEqual(theme, "dark");

    const language = get(user, "settings.preferences.language");
    assert.strictEqual(language, "en");

    const languageTyped: string | null = get(user, "settings.preferences.language");
    assert.strictEqual(languageTyped, "en");

    // Non-existent path should be typed as null
    const nonExistent = get(user, "nonExistent.path");
    assert.strictEqual(nonExistent, null);
    // Type assertion to ensure non-existent paths are typed as null
    const nonExistentTyped: null = get(user, "nonExistent.path");
    assert.strictEqual(nonExistentTyped, null);
  });

  // Test TypeScript type inference with a more complex example and optional fields
  void it("should properly handle complex nested types with optional fields", () => {
    interface User {
      id?: number;
      name?: string;
      settings?: {
        theme: "light" | "dark";
        notifications: boolean;
        preferences?: {
          language?: string | undefined;
        };
      } | null;
    }

    const user: User = {
      id: 1,
      name: "John",
      settings: {
        theme: "dark",
        notifications: true,
        preferences: {
          language: "en",
        },
      },
    };

    const theme = get(user, "settings.theme");
    assert.strictEqual(theme, "dark");

    const language = get(user, "settings.preferences.language");
    assert.strictEqual(language, "en");
  });

  void it("should not reach properties inherited from the prototype chain", () => {
    const obj = { name: "John" };

    assert.strictEqual(get(obj, "__proto__"), null);
    assert.strictEqual(get(obj, "constructor"), null);
    assert.strictEqual(get(obj, "constructor.prototype"), null);
    assert.strictEqual(get(obj, "toString"), null);
  });

  void it("should reach an own property that shadows a prototype key", () => {
    const obj = JSON.parse('{"__proto__": {"polluted": true}}') as Record<string, unknown>;

    assert.strictEqual(get(obj, "__proto__.polluted"), true);
    assert.strictEqual(({} as Record<string, unknown>)["polluted"], undefined);
  });
});
