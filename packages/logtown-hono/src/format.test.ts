import assert from "node:assert/strict";
import { test } from "node:test";

import { compileFormat } from "./format.ts";

void test("renders literals, arguments, messages, and structured fields", () => {
  let calls = 0;
  const compiled = compileFormat<{ method: string }, { stage: string }>(
    ':method [:date[iso]] ":unknown"',
  );
  const result = compiled(
    {
      method: (context) => {
        calls += 1;
        return context.method;
      },
      date: (_context, info, argument) => `${info.stage}/${argument}`,
    },
    { method: "GET" },
    { stage: "after" },
  );

  assert.deepStrictEqual(result, {
    message: 'GET [after/iso] ""',
    method: "GET",
    date: "after/iso",
    unknown: "",
  });
  assert.strictEqual(calls, 2);
});

void test("treats JavaScript-looking format text as inert literals", () => {
  const marker = "__logtown_format_canary__";
  delete (globalThis as Record<string, unknown>)[marker];
  const source = "${globalThis." + marker + " = true} ` literal :method";
  const result = compileFormat<object, object>(source)({ method: () => "GET" }, {}, {});

  assert.strictEqual((globalThis as Record<string, unknown>)[marker], undefined);
  assert.strictEqual(result.message, `${source.slice(0, -":method".length)}GET`);
});

void test("creates hostile token names as safe own properties", () => {
  const transformers = Object.create(null) as Record<string, () => string>;
  transformers["__proto__"] = () => "prototype value";
  transformers["constructor"] = () => "constructor value";
  const result = compileFormat<object, object>(":__proto__ :constructor")(transformers, {}, {});

  assert.strictEqual(Object.getPrototypeOf(result), Object.prototype);
  assert.strictEqual(Object.hasOwn(result, "__proto__"), true);
  assert.strictEqual(result["__proto__"], "prototype value");
  assert.strictEqual(result["constructor"], "constructor value");
});

void test("does not invoke properties inherited by the transformer map", () => {
  const result = compileFormat<object, object>(":__proto__ :constructor :toString")({}, {}, {});

  assert.strictEqual(result.message, "");
  for (const key of ["__proto__", "constructor", "toString"]) {
    assert.strictEqual(Object.hasOwn(result, key), true);
    assert.strictEqual(result[key], "");
  }
});
