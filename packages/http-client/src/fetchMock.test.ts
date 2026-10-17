/**
 * Tests for mock responses, endpoint registration, and pathname matching.
 *
 * @module fetchMock.test
 */

import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import { fetchMock, addEndpointMock, clearEndpointMocks, type TMockMethod } from "./fetchMock.ts";
import { FetchMock } from "./index.ts";

void describe("fetchMock", () => {
  beforeEach(() => {
    clearEndpointMocks();
  });

  void it("returns mocked JSON response for registered endpoint", async () => {
    const endpoint = "/test/endpoint1";
    const url = `https://example.com${endpoint}`;

    addEndpointMock(endpoint, "GET", () => {
      return { success: true };
    });

    const response = await fetchMock(url, { method: "GET" });
    assert.strictEqual(response.status, 200);
    assert.strictEqual(response.headers.get("Content-Type"), "application/json");
    const data = await response.json();
    assert.deepStrictEqual(data, { success: true });
  });

  void it("returns mocked Response object if implementation returns Response", async () => {
    const endpoint = "/test/endpoint2";
    const url = `https://example.com${endpoint}`;

    addEndpointMock(endpoint, "GET", () => {
      return new Response("custom", { status: 201 });
    });

    const response = await fetchMock(url, { method: "GET" });
    assert.strictEqual(response.status, 201);
    const text = await response.text();
    assert.strictEqual(text, "custom");
  });

  void it("throws error if no mock is registered", async () => {
    const endpoint = "/test/endpoint3";
    const url = `https://example.com${endpoint}`;

    await assert.rejects(
      fetchMock(url, { method: "GET" }),
      /No mock data available for this endpoint\./,
    );
  });

  void it("handles implementation errors and returns 500", async () => {
    const endpoint = "/test/endpoint4";
    const url = `https://example.com${endpoint}`;

    addEndpointMock(endpoint, "GET", () => {
      throw new Error("fail");
    });

    const response = await fetchMock(url, { method: "GET" });
    assert.strictEqual(response.status, 500);
    const data = await response.json();
    assert.ok(data && typeof data === "object" && "error" in data);
  });

  void it("supports string, URL, and Request inputs", async () => {
    const endpoint = "/test/endpoint5";
    const url = `https://example.com${endpoint}`;

    addEndpointMock(endpoint, "GET", () => {
      return { ok: 1 };
    });

    // string
    let response = await fetchMock(url, { method: "GET" });
    assert.strictEqual(response.status, 200);

    // URL
    response = await fetchMock(new URL(url), { method: "GET" });
    assert.strictEqual(response.status, 200);

    // Request: its method is used when no init override is provided.
    addEndpointMock(endpoint, "POST", () => ({ posted: true }));
    response = await fetchMock(new Request(url, { method: "POST" }));
    assert.deepStrictEqual(await response.json(), { posted: true });
  });

  void it("defaults to GET method if not provided", async () => {
    const endpoint = "/test/endpoint6";
    const url = `https://example.com${endpoint}`;

    addEndpointMock(endpoint, "GET", () => {
      return { def: true };
    });

    const response = await fetchMock(url);
    assert.strictEqual(response.status, 200);

    const data = await response.json();
    assert.deepStrictEqual(data, { def: true });
  });

  void it("matches endpoints using explicit RegExp patterns", async () => {
    addEndpointMock(/\/test\/regex\/\d+/gy, "GET", () => {
      return { regex: true };
    });

    const url = "https://example.com/test/regex/123";
    const response = await fetchMock(url, { method: "GET" });
    assert.strictEqual(response.status, 200);
    const data = await response.json();
    assert.deepStrictEqual(data, { regex: true });

    const repeated = await fetchMock(url, { method: "GET" });
    assert.deepStrictEqual(await repeated.json(), { regex: true });
  });

  void it("treats string pathnames as exact values", async () => {
    addEndpointMock("/api/users+profile", "GET", () => {
      return { exact: true };
    });

    await assert.rejects(
      fetchMock("https://example.com/api/usersprofile", { method: "GET" }),
      /No mock data available for this endpoint\./,
    );

    const response = await fetchMock("https://example.com/api/users+profile", {
      method: "GET",
    });
    assert.deepStrictEqual(await response.json(), { exact: true });
  });

  void it("matches endpoints that include full URL", async () => {
    addEndpointMock("/test/full/url", "GET", () => {
      return { fallback: true };
    });
    addEndpointMock("https://example.com/test/full/url", "GET", () => {
      return { success: true };
    });

    const url = "https://example.com/test/full/url";
    const response = await fetchMock(url, { method: "GET" });
    assert.strictEqual(response.status, 200);
    const data = await response.json();
    assert.deepStrictEqual(data, { success: true });

    const fallback = await fetchMock("https://other.example.com/test/full/url");
    assert.deepStrictEqual(await fallback.json(), { fallback: true });
  });

  void it("requires a RegExp to match the entire pathname", async () => {
    addEndpointMock(/\/test\/regex/, "GET", () => {
      return { regex: true };
    });

    await assert.rejects(
      fetchMock("https://example.com/test/regex/123", { method: "GET" }),
      /No mock data available for this endpoint\./,
    );
  });

  void it("replaces a registration with the same method and pathname", async () => {
    addEndpointMock("/test/replace", "GET", () => {
      return { version: 1 };
    });
    addEndpointMock("/test/replace", "GET", () => {
      return { version: 2 };
    });

    const response = await fetchMock("https://example.com/test/replace", {
      method: "GET",
    });
    assert.deepStrictEqual(await response.json(), { version: 2 });
  });
});

void describe("FetchMock namespace", () => {
  beforeEach(() => FetchMock.clear());
  afterEach(() => FetchMock.clear());

  void it("matches QUERY separately from GET and POST through both mock APIs", async () => {
    const method: FetchMock.Method = "QUERY";
    const legacyMethod: TMockMethod = method;
    FetchMock.register("/search", "GET", () => ({ method: "GET" }));
    FetchMock.register("/search", "POST", () => ({ method: "POST" }));
    addEndpointMock("/search", legacyMethod, () => ({ method }));
    const request = new Request("https://example.com/search", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Ada" }),
    });

    for (const input of [request.url, new URL(request.url)]) {
      const response: Response = await fetchMock(input, { method, body: "query content" });
      assert.deepStrictEqual(await response.json(), { method: "QUERY" });
    }
    assert.deepStrictEqual(await (await FetchMock.fetch(request)).json(), { method: "QUERY" });
    assert.strictEqual(request.bodyUsed, false);
    assert.deepStrictEqual(await (await FetchMock.fetch(request.url)).json(), { method: "GET" });
    assert.deepStrictEqual(await (await FetchMock.fetch(request, { method: "POST" })).json(), {
      method: "POST",
    });
  });

  void it("shares registrations and clearing with the compatibility API", async () => {
    addEndpointMock("/legacy", "GET", () => ({ api: "legacy" }));
    FetchMock.register("/namespace", "GET", () => ({ api: "namespace" }));

    assert.deepStrictEqual(await (await FetchMock.fetch("https://example.com/legacy")).json(), {
      api: "legacy",
    });
    assert.deepStrictEqual(await (await fetchMock("https://example.com/namespace")).json(), {
      api: "namespace",
    });

    FetchMock.clear();
    await assert.rejects(fetchMock("https://example.com/legacy"), /No mock data/);
    await assert.rejects(fetchMock("https://example.com/namespace"), /No mock data/);

    FetchMock.register("/namespace", "GET", () => ({ api: "namespace" }));
    clearEndpointMocks();
    await assert.rejects(FetchMock.fetch("https://example.com/namespace"), /No mock data/);
  });

  void it("awaits async data and passes the full URL and original options to the implementation", async (context) => {
    const pathname: FetchMock.Pathname = "/users";
    const method: FetchMock.Method = "POST";
    const implementation = context.mock.fn<FetchMock.Implementation>(async (url, options) => ({
      page: url.searchParams.get("page"),
      body: options?.body,
    }));
    const options = Object.freeze({ method: "post", body: "payload" });
    FetchMock.register(pathname, method, implementation);

    const response = await FetchMock.fetch(new URL("https://example.com/users?page=2"), options);

    assert.strictEqual(response.status, 200);
    assert.strictEqual(response.headers.get("Content-Type"), "application/json");
    assert.deepStrictEqual(await response.json(), { page: "2", body: "payload" });
    assert.strictEqual(implementation.mock.callCount(), 1);
    assert.strictEqual(
      implementation.mock.calls[0]?.arguments[0].href,
      "https://example.com/users?page=2",
    );
    assert.strictEqual(implementation.mock.calls[0]?.arguments[1], options);
  });

  void it("preserves a Response returned asynchronously", async () => {
    const response = new Response("created", { status: 201, headers: { "X-Mock": "yes" } });
    FetchMock.register("/users", "POST", async () => response);

    const result = await FetchMock.fetch("https://example.com/users", { method: "POST" });

    assert.strictEqual(result, response);
    assert.strictEqual(result.bodyUsed, false);
    assert.strictEqual(result.headers.get("X-Mock"), "yes");
    assert.strictEqual(await result.text(), "created");
  });

  void it("lets init override a Request method without changing the Request", async () => {
    FetchMock.register("/users", "POST", () => ({ method: "POST" }));
    FetchMock.register("/users", "PATCH", () => ({ method: "PATCH" }));
    const request = new Request("https://example.com/users", { method: "POST" });

    assert.deepStrictEqual(await (await FetchMock.fetch(request, { method: "patch" })).json(), {
      method: "PATCH",
    });
    assert.deepStrictEqual(await (await FetchMock.fetch(request)).json(), { method: "POST" });
    assert.strictEqual(request.method, "POST");
    await assert.rejects(FetchMock.fetch(request, { method: "DELETE" }), /No mock data/);
  });

  void it("replaces equivalent regexp registrations without disturbing other methods", async () => {
    const pattern = /\/users\/\d+/giy;
    pattern.lastIndex = 7;
    FetchMock.register(pattern, "GET", () => ({ version: 1 }));
    FetchMock.register(/\/users\/\d+/i, "GET", () => ({ version: 2 }));
    FetchMock.register(/\/users\/\d+/i, "POST", () => ({ created: true }));

    for (let attempt = 0; attempt < 2; attempt += 1) {
      assert.deepStrictEqual(
        await (await FetchMock.fetch("https://example.com/USERS/123")).json(),
        { version: 2 },
      );
    }
    assert.deepStrictEqual(
      await (await FetchMock.fetch("https://example.com/USERS/123", { method: "POST" })).json(),
      { created: true },
    );
    assert.strictEqual(pattern.lastIndex, 7);
    await assert.rejects(FetchMock.fetch("https://example.com/USERS/123/extra"), /No mock data/);
  });

  void it("converts rejected implementations and unserializable data into JSON 500 responses", async (context) => {
    const failure = new Error("async failure");
    const logged = context.mock.method(console, "error", () => {});
    FetchMock.register("/rejected", "GET", async () => {
      throw failure;
    });
    FetchMock.register("/unserializable", "GET", () => 1n);

    for (const path of ["/rejected", "/unserializable"]) {
      const response = await FetchMock.fetch(`https://example.com${path}`);
      assert.strictEqual(response.status, 500);
      assert.strictEqual(response.headers.get("Content-Type"), "application/json");
      assert.deepStrictEqual(await response.json(), { error: "Internal Server Error" });
    }
    assert.strictEqual(logged.mock.callCount(), 2);
    assert.strictEqual(logged.mock.calls[0]?.arguments[1], failure);
  });
});
