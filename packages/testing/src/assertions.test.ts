import assert from "node:assert/strict";
import { describe, mock, test } from "node:test";

import { getRejection, mockImplementationSequence } from "./assertions.ts";

void describe("assertion helpers", () => {
  void test("returns rejected values", async () => {
    assert.strictEqual(await getRejection(Promise.reject("reason")), "reason");
    await assert.rejects(
      () => getRejection(Promise.resolve("value")),
      (error: unknown) => {
        assert.ok(error instanceof assert.AssertionError);
        assert.strictEqual(error.actual, "value");
        assert.strictEqual(error.expected, "a rejected promise");
        assert.strictEqual(error.operator, "rejects");
        return true;
      },
    );
  });

  void test("queues implementations after existing native mock calls", () => {
    const fn = mock.fn((value: number) => value);
    assert.strictEqual(fn(1), 1);

    mockImplementationSequence(fn, [(value: number) => value + 1, (value: number) => value + 2]);

    assert.strictEqual(fn(1), 2);
    assert.strictEqual(fn(1), 3);
    assert.strictEqual(fn(1), 1);
  });
});
