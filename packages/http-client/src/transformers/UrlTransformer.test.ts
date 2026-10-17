/**
 * Tests for URL path and query transformations.
 *
 * @module transformers/UrlTransformer.test
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { HttpClient, UrlTransformer } from "../index.ts";

void describe("UrlTransformer", () => {
  void it("copies URL inputs and appends duplicate query keys without changing options", async (context) => {
    const input = new URL("https://example.com/users?tag=first#section");
    const init = Object.freeze({ credentials: "include" } as const);
    const fetch = context.mock.fn(async (..._params: HttpClient.Params) => new Response());
    const client = HttpClient.make(
      [
        UrlTransformer.prependPath("/v1"),
        UrlTransformer.appendQuery({ tag: "second", name: "Ada Lovelace" }),
      ],
      fetch,
    );

    await client(input, init);
    await client(input, init);

    assert.strictEqual(fetch.mock.callCount(), 2);
    for (const {
      arguments: [url, options],
    } of fetch.mock.calls) {
      assert.ok(url instanceof URL);
      if (!(url instanceof URL)) {
        throw new TypeError("expected a URL input");
      }
      assert.notStrictEqual(url, input);
      assert.strictEqual(
        url.href,
        "https://example.com/v1/users?tag=first&tag=second&name=Ada+Lovelace#section",
      );
      assert.strictEqual(options, init);
    }
    assert.strictEqual(input.href, "https://example.com/users?tag=first#section");
  });

  void it("appends query parameters to relative paths", async (context) => {
    const fetch = context.mock.fn(async (..._params: HttpClient.Params) => new Response());
    const client = HttpClient.make(
      [UrlTransformer.prependPath("/v1"), UrlTransformer.appendQuery({ tag: "second", q: "a&b" })],
      fetch,
    );

    await client("/users?tag=first");

    assert.deepStrictEqual(fetch.mock.calls[0]?.arguments, [
      "/v1/users?tag=first&tag=second&q=a%26b",
      undefined,
    ]);
  });
});
