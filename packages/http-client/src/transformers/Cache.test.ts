/**
 * Tests for cache ownership, request identity, expiration, and eviction.
 *
 * @module transformers/Cache.test
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Cache, HttpClient } from "../index.ts";

void describe("Cache.make", () => {
  void it("bypasses QUERY requests without reusing or replacing cached GET responses", async (context) => {
    const fetch = context.mock.fn(async (input: HttpClient.Params[0], init?: RequestInit) => {
      const request = new Request(input, init);
      return new Response(request.method === "GET" ? "all users" : await request.text());
    });
    const client = HttpClient.make([Cache.make()], fetch);
    const url = "https://example.com/users";
    const headers = { "Content-Type": "application/json" };

    assert.strictEqual(await (await client(url, { headers })).text(), "all users");
    for (const name of ["Ada", "Grace", "Ada"]) {
      const body = JSON.stringify({ name });
      const init = { method: "QUERY", headers, body };
      assert.strictEqual(await (await client(url, init)).text(), body);
      assert.strictEqual(await (await client(new Request(url, init))).text(), body);
    }
    assert.strictEqual(await (await client(url, { headers })).text(), "all users");
    assert.strictEqual(fetch.mock.callCount(), 7);
  });

  void it("keeps separately created caches isolated and returns independently readable responses", async (context) => {
    const fetch = context.mock.fn(async () => new Response("cached"));
    const first = HttpClient.make([Cache.make()], fetch);
    const second = HttpClient.make([Cache.make()], fetch);
    const original = await first("https://example.com");
    assert.strictEqual(await original.text(), "cached");
    original.headers.set("X-Caller", "changed");

    const hit = await first("https://example.com");
    assert.notStrictEqual(hit, original);
    assert.strictEqual(hit.headers.get("X-Caller"), null);
    assert.strictEqual(await hit.text(), "cached");
    assert.strictEqual(await (await first("https://example.com")).text(), "cached");
    assert.strictEqual(fetch.mock.callCount(), 1);

    assert.strictEqual(await (await second("https://example.com")).text(), "cached");
    assert.strictEqual(fetch.mock.callCount(), 2);
  });

  void it("expires entries at maxAge without extending their lifetime on a hit", async (context) => {
    context.mock.timers.enable({ apis: ["Date"], now: 1000 });
    const fetch = context.mock.fn(async () => new Response("cached"));
    const client = HttpClient.make([Cache.make(100)], fetch);

    await client("https://example.com");
    context.mock.timers.tick(99);
    await client("https://example.com");
    assert.strictEqual(fetch.mock.callCount(), 1);

    context.mock.timers.tick(1);
    await client("https://example.com");
    await client("https://example.com");
    assert.strictEqual(fetch.mock.callCount(), 2);
  });

  void it("refreshes eviction order when an entry is read", async (context) => {
    const fetch = context.mock.fn(async (..._params: HttpClient.Params) => new Response("cached"));
    const client = HttpClient.make([Cache.make(60_000, 2)], fetch);

    for (const path of ["/a", "/b", "/a", "/c", "/a", "/b"]) {
      await client(`https://example.com${path}`);
    }

    assert.deepStrictEqual(
      fetch.mock.calls.map(({ arguments: [url] }) => url),
      [
        "https://example.com/a",
        "https://example.com/b",
        "https://example.com/c",
        "https://example.com/b",
      ],
    );
  });

  for (const [maxAge, maxEntries] of [
    [0, 10],
    [-1, 10],
    [1000, 0],
    [1000, -1],
  ] as const) {
    void it(`bypasses caching with maxAge=${maxAge} and maxEntries=${maxEntries}`, async (context) => {
      const fetch = context.mock.fn(async () => new Response("uncached"));
      const client = HttpClient.make([Cache.make(maxAge, maxEntries)], fetch);

      await client("https://example.com");
      await client("https://example.com");

      assert.strictEqual(fetch.mock.callCount(), 2);
    });
  }

  void it("does not store responses with a wildcard Vary directive", async (context) => {
    const fetch = context.mock.fn(
      async () => new Response("varies", { headers: { Vary: "Accept, *" } }),
    );
    const client = HttpClient.make([Cache.make()], fetch);

    assert.strictEqual(await (await client("https://example.com")).text(), "varies");
    assert.strictEqual(await (await client("https://example.com")).text(), "varies");
    assert.strictEqual(fetch.mock.callCount(), 2);
  });

  for (const [field, options] of [
    ["headers", { headers: { Authorization: "Bearer other" } }],
    ["credentials", { credentials: "include" }],
    ["mode", { mode: "same-origin" }],
    ["referrer", { referrer: "https://example.com/page" }],
    ["referrerPolicy", { referrerPolicy: "origin" }],
  ] as const satisfies ReadonlyArray<readonly [string, RequestInit]>) {
    void it(`distinguishes Request ${field} and honors init overrides in cache keys`, async (context) => {
      const fetch = context.mock.fn(async () => new Response("cached"));
      const client = HttpClient.make([Cache.make()], fetch);
      const original = new Request("https://example.com");
      const changed = new Request("https://example.com", options);

      await client(original);
      await client(original);
      assert.strictEqual(fetch.mock.callCount(), 1);
      await client(changed);
      assert.strictEqual(fetch.mock.callCount(), 2);
      await client(original, options);
      assert.strictEqual(fetch.mock.callCount(), 2);
    });
  }
});
