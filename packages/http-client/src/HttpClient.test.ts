/**
 * Tests for fetch-compatible composition through the public namespace API.
 *
 * @module HttpClient.test
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { HttpClient } from "./index.ts";

void describe("HttpClient.make", () => {
  void it("returns the supplied client unchanged for an empty transformer list", () => {
    const client: HttpClient.Type = async () => new Response();

    assert.strictEqual(HttpClient.make(Object.freeze([]), client), client);
  });

  void it("uses global fetch when no client is supplied", async (context) => {
    const response = new Response("global");
    const fetch = context.mock.method(globalThis, "fetch", async () => response);
    const client = HttpClient.make([]);

    assert.strictEqual(client, fetch);
    assert.strictEqual(await client("https://example.com"), response);
    assert.deepStrictEqual(fetch.mock.calls[0]?.arguments, ["https://example.com"]);
  });

  for (const input of [
    "https://example.com/users",
    new URL("https://example.com/users"),
    new Request("https://example.com/users"),
  ]) {
    void it(`preserves ${typeof input === "string" ? "string" : input.constructor.name} inputs, options, and responses`, async (context) => {
      const init = Object.freeze({ credentials: "include" } as const);
      const response = new Response("unchanged");
      const fetch = context.mock.fn(async (..._params: HttpClient.Params) => response);
      const forward: HttpClient.Transformer = async (next, ...params) => next(...params);

      assert.strictEqual(await HttpClient.make([forward], fetch)(input, init), response);
      assert.strictEqual(fetch.mock.callCount(), 1);
      assert.strictEqual(fetch.mock.calls[0]?.arguments[0], input);
      assert.strictEqual(fetch.mock.calls[0]?.arguments[1], init);
    });
  }

  void it("runs readonly transformers in order and unwinds responses in reverse order", async () => {
    const events: string[] = [];
    const first: HttpClient.Transformer = async (next, ...params) => {
      events.push("first request");
      const response = await next(...params);
      events.push("first response");
      return response;
    };
    const second: HttpClient.Transformer = async (next, ...params) => {
      events.push("second request");
      const response = await next(...params);
      events.push("second response");
      return response;
    };
    const transformers = Object.freeze([first, second]);
    const response = new Response("ordered");
    const client = HttpClient.make(transformers, async () => {
      events.push("fetch");
      return response;
    });

    assert.strictEqual(await client("https://example.com"), response);
    assert.deepStrictEqual(events, [
      "first request",
      "second request",
      "fetch",
      "second response",
      "first response",
    ]);
    assert.deepStrictEqual(transformers, [first, second]);
  });

  void it("allows a transformer to return without calling the rest of the chain", async (context) => {
    const response = new Response("local");
    const nextTransformer = context.mock.fn<HttpClient.Transformer>(async (next, ...params) =>
      next(...params),
    );
    const fetch = context.mock.fn(async () => new Response("remote"));
    const client = HttpClient.make([async () => response, nextTransformer], fetch);

    assert.strictEqual(await client("https://example.com"), response);
    assert.strictEqual(nextTransformer.mock.callCount(), 0);
    assert.strictEqual(fetch.mock.callCount(), 0);
  });

  void it("propagates the original transport failure through transformers", async () => {
    const failure = new TypeError("offline");
    const client = HttpClient.make([async (next, ...params) => next(...params)], async () => {
      throw failure;
    });

    await assert.rejects(client("https://example.com"), (error: unknown) => error === failure);
  });

  void it("rejects with a synchronous transformer failure without calling fetch", async (context) => {
    const failure = new Error("invalid configuration");
    const fetch = context.mock.fn(async () => new Response());
    const client = HttpClient.make(
      [
        () => {
          throw failure;
        },
      ],
      fetch,
    );

    await assert.rejects(client("https://example.com"), (error: unknown) => error === failure);
    assert.strictEqual(fetch.mock.callCount(), 0);
  });
});
