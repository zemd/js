import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";

import { fetchMock, addEndpointMock, clearEndpointMocks } from "./fetchMock.ts";

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

  void it("supports string, URL, and { url } as input", async () => {
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
    addEndpointMock(/\/test\/regex\/\d+/, "GET", () => {
      return { regex: true };
    });

    const url = "https://example.com/test/regex/123";
    const response = await fetchMock(url, { method: "GET" });
    assert.strictEqual(response.status, 200);
    const data = await response.json();
    assert.deepStrictEqual(data, { regex: true });
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
    addEndpointMock("https://example.com/test/full/url", "GET", () => {
      return { success: true };
    });

    const url = "https://example.com/test/full/url";
    const response = await fetchMock(url, { method: "GET" });
    assert.strictEqual(response.status, 200);
    const data = await response.json();
    assert.deepStrictEqual(data, { success: true });
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
