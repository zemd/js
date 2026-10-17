/**
 * Tests for sanitized request logging and logger failures.
 *
 * @module transformers/Debug.test
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Debug, HttpClient } from "../index.ts";

void describe("Debug.make", () => {
  void it("logs effective request metadata before forwarding without consuming the body", async (context) => {
    const request = new Request("https://example.com?token=secret", {
      method: "POST",
      headers: { "X-Original": "original" },
      body: "private body",
    });
    const init = Object.freeze({
      method: "PUT",
      headers: { Authorization: "Bearer secret", Accept: "text/plain" },
    });
    const logger = context.mock.fn<Debug.Logger>();
    const response = new Response("ok");
    const fetch = context.mock.fn(async (...params: HttpClient.Params) => {
      assert.strictEqual(logger.mock.callCount(), 1);
      assert.strictEqual(params[0], request);
      assert.strictEqual(params[1], init);
      return response;
    });

    assert.strictEqual(await HttpClient.make([Debug.make(logger)], fetch)(request, init), response);
    assert.deepStrictEqual(logger.mock.calls[0]?.arguments, [
      {
        bodyPresent: true,
        headers: { authorization: "[REDACTED]", accept: "text/plain" },
        method: "PUT",
        url: "https://example.com/?token=%5BREDACTED%5D",
      },
    ]);
    assert.strictEqual(request.bodyUsed, false);
    assert.strictEqual(await request.text(), "private body");
    assert.strictEqual(init.headers.Authorization, "Bearer secret");
  });

  void it("propagates logger failures without sending the request", async (context) => {
    const failure = new Error("logger failed");
    const fetch = context.mock.fn(async () => new Response());
    const client = HttpClient.make(
      [
        Debug.make(() => {
          throw failure;
        }),
      ],
      fetch,
    );

    await assert.rejects(client("https://example.com"), (error: unknown) => error === failure);
    assert.strictEqual(fetch.mock.callCount(), 0);
  });
});
