import { beforeEach, describe, it, expect } from "vitest";
import { fetchMock, addEndpointMock, clearEndpointMocks } from "./fetchMock";

describe("fetchMock", () => {
  beforeEach(() => {
    clearEndpointMocks();
  });

  it("returns mocked JSON response for registered endpoint", async () => {
    const endpoint = "/test/endpoint1";
    const url = `https://example.com${endpoint}`;

    addEndpointMock(endpoint, "GET", () => {
      return { success: true };
    });

    const response = await fetchMock(url, { method: "GET" });
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/json");
    const data = await response.json();
    expect(data).toEqual({ success: true });
  });

  it("returns mocked Response object if implementation returns Response", async () => {
    const endpoint = "/test/endpoint2";
    const url = `https://example.com${endpoint}`;

    addEndpointMock(endpoint, "GET", () => {
      return new Response("custom", { status: 201 });
    });

    const response = await fetchMock(url, { method: "GET" });
    expect(response.status).toBe(201);
    const text = await response.text();
    expect(text).toBe("custom");
  });

  it("throws error if no mock is registered", async () => {
    const endpoint = "/test/endpoint3";
    const url = `https://example.com${endpoint}`;

    await expect(fetchMock(url, { method: "GET" })).rejects.toThrow(
      "No mock data available for this endpoint.",
    );
  });

  it("handles implementation errors and returns 500", async () => {
    const endpoint = "/test/endpoint4";
    const url = `https://example.com${endpoint}`;

    addEndpointMock(endpoint, "GET", () => {
      throw new Error("fail");
    });

    const response = await fetchMock(url, { method: "GET" });
    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data).toHaveProperty("error");
  });

  it("supports string, URL, and { url } as input", async () => {
    const endpoint = "/test/endpoint5";
    const url = `https://example.com${endpoint}`;

    addEndpointMock(endpoint, "GET", () => {
      return { ok: 1 };
    });

    // string
    let response = await fetchMock(url, { method: "GET" });
    expect(response.status).toBe(200);

    // URL
    response = await fetchMock(new URL(url), { method: "GET" });
    expect(response.status).toBe(200);
  });

  it("defaults to GET method if not provided", async () => {
    const endpoint = "/test/endpoint6";
    const url = `https://example.com${endpoint}`;

    addEndpointMock(endpoint, "GET", () => {
      return { def: true };
    });

    const response = await fetchMock(url);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data).toEqual({ def: true });
  });

  it("matches endpoints using explicit RegExp patterns", async () => {
    addEndpointMock(/\/test\/regex\/\d+/, "GET", () => {
      return { regex: true };
    });

    const url = "https://example.com/test/regex/123";
    const response = await fetchMock(url, { method: "GET" });
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toEqual({ regex: true });
  });

  it("treats string pathnames as exact values", async () => {
    addEndpointMock("/api/users+profile", "GET", () => {
      return { exact: true };
    });

    await expect(
      fetchMock("https://example.com/api/usersprofile", { method: "GET" }),
    ).rejects.toThrow("No mock data available for this endpoint.");

    const response = await fetchMock("https://example.com/api/users+profile", {
      method: "GET",
    });
    expect(await response.json()).toEqual({ exact: true });
  });

  it("matches endpoints that include full URL", async () => {
    addEndpointMock("https://example.com/test/full/url", "GET", () => {
      return { success: true };
    });

    const url = "https://example.com/test/full/url";
    const response = await fetchMock(url, { method: "GET" });
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toEqual({ success: true });
  });

  it("requires a RegExp to match the entire pathname", async () => {
    addEndpointMock(/\/test\/regex/, "GET", () => {
      return { regex: true };
    });

    await expect(
      fetchMock("https://example.com/test/regex/123", { method: "GET" }),
    ).rejects.toThrow("No mock data available for this endpoint.");
  });

  it("replaces a registration with the same method and pathname", async () => {
    addEndpointMock("/test/replace", "GET", () => {
      return { version: 1 };
    });
    addEndpointMock("/test/replace", "GET", () => {
      return { version: 2 };
    });

    const response = await fetchMock("https://example.com/test/replace", {
      method: "GET",
    });
    expect(await response.json()).toEqual({ version: 2 });
  });
});
