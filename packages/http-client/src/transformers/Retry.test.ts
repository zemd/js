/**
 * Tests for retry decisions and response ownership through the namespace API.
 *
 * @module transformers/Retry.test
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { HttpClient, Retry } from "../index.ts";

void describe("Retry.make", () => {
  void it("does not retry aborts and preserves the original error", async (context) => {
    const failure = new DOMException("cancelled", "AbortError");
    const fetch = context.mock.fn(async () => {
      throw failure;
    });
    const client = HttpClient.make([Retry.make(3, 0)], fetch);

    await assert.rejects(client("https://example.com"), (error: unknown) => error === failure);
    assert.strictEqual(fetch.mock.callCount(), 1);
  });

  void it("returns the final failed response with its body readable after exhausting retries", async (context) => {
    const first = new Response("discarded", { status: 503 });
    const last = new Response("final failure", { status: 503 });
    const fetch = context.mock.fn(async () => last);
    fetch.mock.mockImplementationOnce(async () => first);

    const response = await HttpClient.make([Retry.make(1, 0)], fetch)("https://example.com");

    assert.strictEqual(fetch.mock.callCount(), 2);
    assert.strictEqual(first.bodyUsed, true);
    assert.strictEqual(response, last);
    assert.strictEqual(response.bodyUsed, false);
    assert.strictEqual(await response.text(), "final failure");
  });

  void it("passes one-based attempts to the predicate and cancels discarded bodies before retrying", async (context) => {
    const cancel = context.mock.fn(() => {});
    const first = new Response(new ReadableStream({ cancel }), { status: 429 });
    const second = new Response("still limited", { status: 429 });
    const fetch = context.mock.fn(async () => {
      assert.strictEqual(cancel.mock.callCount(), 1);
      return second;
    });
    fetch.mock.mockImplementationOnce(async () => first);
    const predicate = context.mock.fn<Retry.ShouldRetry>(
      (error, attempt) => error instanceof Response && attempt === 1,
    );
    const client = HttpClient.make([Retry.make(3, 0, 1, predicate)], fetch);

    assert.strictEqual(await client("https://example.com"), second);
    assert.deepStrictEqual(
      predicate.mock.calls.map(({ arguments: args }) => args),
      [
        [first, 1],
        [second, 2],
      ],
    );
    assert.strictEqual(fetch.mock.callCount(), 2);
    assert.strictEqual(await second.text(), "still limited");
  });

  void it("skips the retry predicate and preserves the response when retries are disabled", async (context) => {
    const response = new Response("unavailable", { status: 503 });
    const fetch = context.mock.fn(async () => response);
    const predicate = context.mock.fn<Retry.ShouldRetry>(() => true);

    assert.strictEqual(
      await HttpClient.make([Retry.make(0, 0, 1, predicate)], fetch)("https://example.com"),
      response,
    );
    assert.strictEqual(fetch.mock.callCount(), 1);
    assert.strictEqual(predicate.mock.callCount(), 0);
    assert.strictEqual(response.bodyUsed, false);
  });
});
