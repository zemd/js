/**
 * Tests for immutable request method, header, and body transformations.
 *
 * @module transformers/RequestTransformer.test
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { HttpClient, RequestTransformer } from "../index.ts";

void describe("RequestTransformer", () => {
  void it("appends headers without changing reusable request options or headers", async (context) => {
    const headers = new Headers({ "X-Trace": "original" });
    const init = Object.freeze({ headers, credentials: "include" } as const);
    const fetch = context.mock.fn(
      async (_input: HttpClient.Params[0], options?: HttpClient.Params[1]) => {
        assert.notStrictEqual(options, init);
        assert.strictEqual(options?.credentials, "include");
        assert.strictEqual(new Headers(options?.headers).get("X-Trace"), "original, appended");
        return new Response();
      },
    );
    const client = HttpClient.make([RequestTransformer.appendHeader("X-Trace", "appended")], fetch);

    await client("https://example.com", init);
    await client("https://example.com", init);

    assert.strictEqual(headers.get("X-Trace"), "original");
    assert.strictEqual(init.headers, headers);
  });

  void it("sets the body without changing reusable request options", async (context) => {
    const init = Object.freeze({
      method: "POST",
      body: "original",
      credentials: "include",
    } as const);
    const fetch = context.mock.fn(
      async (_input: HttpClient.Params[0], options?: HttpClient.Params[1]) => {
        assert.notStrictEqual(options, init);
        assert.deepStrictEqual(options, { ...init, body: "replacement" });
        return new Response();
      },
    );

    await HttpClient.make([RequestTransformer.setBody("replacement")], fetch)(
      "https://example.com",
      init,
    );

    assert.strictEqual(init.body, "original");
  });

  void it("sets the method without changing reusable options", async (context) => {
    const init = Object.freeze({ method: "GET", credentials: "include" } as const);
    const fetch = context.mock.fn(async (..._params: HttpClient.Params) => new Response());
    const client = HttpClient.make([RequestTransformer.setMethod("PATCH")], fetch);

    await client("https://example.com", init);
    await client("https://example.com", init);

    assert.strictEqual(fetch.mock.callCount(), 2);
    for (const {
      arguments: [, options],
    } of fetch.mock.calls) {
      assert.notStrictEqual(options, init);
      assert.deepStrictEqual(options, { method: "PATCH", credentials: "include" });
    }
    assert.strictEqual(init.method, "GET");
  });

  void it("appends the JSON content type while forwarding the supplied body unchanged", async (context) => {
    const headers = Object.freeze({ "Content-Type": "text/plain" });
    const init = Object.freeze({ method: "POST", headers });
    const body = new URLSearchParams({ name: "Ada" });
    const fetch = context.mock.fn(async (..._params: HttpClient.Params) => new Response());
    const client = HttpClient.make(
      [RequestTransformer.jsonContentType(), RequestTransformer.setBody(body)],
      fetch,
    );

    await client("https://example.com", init);

    const options = fetch.mock.calls[0]?.arguments[1];
    assert.strictEqual(
      new Headers(options?.headers).get("Content-Type"),
      "text/plain, application/json",
    );
    assert.strictEqual(options?.body, body);
    assert.strictEqual(options?.method, "POST");
    assert.deepStrictEqual(headers, { "Content-Type": "text/plain" });
  });
});
