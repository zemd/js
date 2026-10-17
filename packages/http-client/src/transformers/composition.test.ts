/**
 * Tests for composition across transformer namespaces.
 *
 * @module transformers/composition.test
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Cache, Debug, HttpClient, RequestTransformer, Retry, UrlTransformer } from "../index.ts";

void describe("transformer composition", () => {
  void it("composes namespaced transformers with retries, caching, and sanitized logging", async (context) => {
    const requests: HttpClient.Params[] = [];
    const fetch = context.mock.fn(async (...params: HttpClient.Params) => {
      requests.push(params);
      return requests.length === 1
        ? new Response("Unavailable", { status: 503 })
        : Response.json({ name: "Ada" });
    });
    const metadata: Debug.RequestMetadata[] = [];
    const logger: Debug.Logger = (request) => {
      metadata.push(request);
    };
    const transformers = [
      UrlTransformer.prependPath("https://example.com"),
      UrlTransformer.appendQuery({ page: "1" }),
      RequestTransformer.setMethod("GET"),
      Retry.make(1, 0),
      RequestTransformer.appendHeader("Authorization", "Bearer secret"),
      RequestTransformer.jsonContentType(),
      Cache.make(),
      Debug.make(logger),
    ] as const;
    const client = HttpClient.make(transformers, fetch);
    const path = `/users/${UrlTransformer.encodePathSegment("Ada Lovelace")}`;

    assert.deepStrictEqual(await (await client(path)).json(), { name: "Ada" });
    assert.deepStrictEqual(await (await client(path)).json(), { name: "Ada" });
    assert.strictEqual(fetch.mock.callCount(), 2);
    assert.strictEqual(metadata.length, 2);
    for (const [url, init] of requests) {
      assert.strictEqual(url, "https://example.com/users/Ada%20Lovelace?page=1");
      assert.strictEqual(new Headers(init?.headers).get("Authorization"), "Bearer secret");
      assert.strictEqual(new Headers(init?.headers).get("Content-Type"), "application/json");
    }
    for (const request of metadata) {
      assert.strictEqual(request.headers["authorization"], "[REDACTED]");
      assert.strictEqual(request.method, "GET");
    }
  });
});
