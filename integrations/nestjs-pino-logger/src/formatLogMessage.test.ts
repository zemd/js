import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { formatLogMessage } from "@zemd/nestjs-pino-logger";

void describe("formatLogMessage", () => {
  void it("combines interpolation values into one plain message", () => {
    assert.strictEqual(formatLogMessage("Hello %s %d", "world", 42), "Hello world 42");
    assert.strictEqual(formatLogMessage("value: %j", { id: 42 }), 'value: {"id":42}');
    assert.strictEqual(formatLogMessage("values", 42, true), "values 42 true");
  });

  void it("formats non-string messages without terminal colors", () => {
    assert.strictEqual(formatLogMessage(null), "null");
    assert.strictEqual(formatLogMessage(undefined), "undefined");
    assert.strictEqual(formatLogMessage(Symbol("value")), "Symbol(value)");
  });
});
