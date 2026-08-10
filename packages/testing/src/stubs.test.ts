import assert from "node:assert/strict";
import { test } from "node:test";

import { stubEnvironment } from "./stubs.ts";

void test("stubEnvironment restores existing and missing variables", (context) => {
  const missing = `ZEMD_TESTING_MISSING_ENV_${String(process.pid)}`;
  const existing = `ZEMD_TESTING_EXISTING_ENV_${String(process.pid)}`;
  const originalMissing = process.env[missing];
  const originalExisting = process.env[existing];

  try {
    delete process.env[missing];
    process.env[existing] = "original";

    const restore = stubEnvironment(context, { [missing]: "temporary", [existing]: undefined });
    assert.strictEqual(process.env[missing], "temporary");
    assert.strictEqual(process.env[existing], undefined);

    restore();
    restore();
    assert.strictEqual(process.env[missing], undefined);
    assert.strictEqual(process.env[existing], "original");
  } finally {
    restoreTestEnvironment(missing, originalMissing);
    restoreTestEnvironment(existing, originalExisting);
  }
});

void test("stubEnvironment automatically restores stacked values in LIFO order", async (context) => {
  const key = `ZEMD_TESTING_STACKED_ENV_${String(process.pid)}`;
  const existed = Object.hasOwn(process.env, key);
  const original = process.env[key];

  try {
    await context.test("uses stacked environment stubs", (subcontext) => {
      stubEnvironment(subcontext, { [key]: "first" });
      stubEnvironment(subcontext, { [key]: "second" });
      assert.strictEqual(process.env[key], "second");
    });

    assert.strictEqual(Object.hasOwn(process.env, key), existed);
    assert.strictEqual(process.env[key], original);
  } finally {
    if (existed) {
      process.env[key] = original;
    } else {
      delete process.env[key];
    }
  }
});

function restoreTestEnvironment(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}
