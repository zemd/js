import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildPinoMessage, PinoMessageSymbol } from "@zemd/nestjs-pino-logger";

void describe("buildPinoMessage", () => {
  void it("marks a new structured message without mutating its input", () => {
    const interpolationValues = ["world", 42];
    const mergingObject = { requestId: "01JABC" };
    const message = {
      message: "Hello %s %d",
      interpolationValues,
      mergingObject,
    };

    const result = buildPinoMessage(message);

    assert.notStrictEqual(result, message);
    assert.strictEqual(Object.isFrozen(result), true);
    assert.strictEqual(Object.hasOwn(message, PinoMessageSymbol), false);
    assert.strictEqual(result[PinoMessageSymbol], true);
    assert.strictEqual(result.interpolationValues, interpolationValues);
    assert.strictEqual(result.mergingObject, mergingObject);
  });

  void it("supports a message without optional structured fields", () => {
    const message = Object.freeze({ message: "ready" });

    assert.deepStrictEqual(buildPinoMessage(message), {
      message: "ready",
      [PinoMessageSymbol]: true,
    });
  });
});
