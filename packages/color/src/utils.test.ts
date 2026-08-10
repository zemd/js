import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  decodeSrgbChannel,
  encodeLinearSrgbChannel,
  encodeLinearSrgbChannelTo8Bit,
} from "./utils.ts";

void describe("sRGB channel utilities", () => {
  void it("decodes channel endpoints", () => {
    assert.strictEqual(decodeSrgbChannel(0), 0);
    assert.strictEqual(decodeSrgbChannel(255), 1);
  });

  void it("decodes monotonically around the sRGB threshold", () => {
    assert.ok(decodeSrgbChannel(11) > decodeSrgbChannel(10));
  });

  void it("encodes linear channel endpoints", () => {
    assert.strictEqual(encodeLinearSrgbChannel(0), 0);
    assert.ok(Math.abs(encodeLinearSrgbChannel(1) - 1) < 0.5 * 10 ** -15);
  });

  void it("rounds and clamps to 8-bit sRGB", () => {
    assert.strictEqual(encodeLinearSrgbChannelTo8Bit(-0.1), 0);
    assert.strictEqual(encodeLinearSrgbChannelTo8Bit(1.1), 255);
    assert.strictEqual(encodeLinearSrgbChannelTo8Bit(0.5), 188);
  });

  void it("clamps channels before converting them to 8-bit integers", () => {
    assert.strictEqual(encodeLinearSrgbChannelTo8Bit(-Number.MAX_VALUE), 0);
    assert.strictEqual(encodeLinearSrgbChannelTo8Bit(Number.MAX_VALUE), 255);
  });
});
