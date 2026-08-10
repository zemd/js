import { describe, it, expect, vi, beforeEach, type Mock, afterEach } from "vitest";
import {
  compose,
  method,
  header,
  json,
  prefix,
  query,
  debug,
  retry,
  cache,
  createEndpoint,
} from "./";
import type { TFetchTransformer } from "./type";

describe("HTTP Client", () => {
  let mockFetch: Mock<typeof fetch>;

  beforeEach(() => {
    mockFetch = vi.fn(async (): Promise<Response> => {
      return Response.json(
        { data: "test" },
        {
          headers: { "Content-Type": "application/json" },
        },
      );
    });
    globalThis.fetch = mockFetch;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  const expectRequestUrlTransformToPreserveInit = async (
    transformer: TFetchTransformer,
    expectedUrl: string,
  ): Promise<void> => {
    const abortController = new AbortController();
    const request = new Request("https://api.example.com/users?existing=true", {
      method: "POST",
      headers: { Authorization: "Bearer token", "X-Custom": "value" },
      body: "request body",
      cache: "no-store",
      credentials: "include",
      integrity: "sha256-test",
      mode: "cors",
      redirect: "manual",
      referrer: "https://referrer.example.com/",
      referrerPolicy: "origin",
      signal: abortController.signal,
    });

    // RequestInit-compatible properties are prototype getters, so spreading the Request
    // would copy none of the values asserted below.
    for (const property of [
      "method",
      "headers",
      "body",
      "cache",
      "credentials",
      "integrity",
      "mode",
      "redirect",
      "referrer",
      "referrerPolicy",
      "signal",
    ]) {
      expect(Object.prototype.propertyIsEnumerable.call(request, property)).toBe(false);
    }

    await compose([transformer])(request);

    const [forwarded, init] = mockFetch.mock.calls[0] ?? [];
    expect(forwarded).toBeInstanceOf(Request);
    expect(init).toBeUndefined();

    const forwardedRequest = forwarded as Request;
    expect(forwardedRequest.url).toBe(expectedUrl);
    expect(forwardedRequest.method).toBe("POST");
    expect(Object.fromEntries(forwardedRequest.headers.entries())).toEqual({
      authorization: "Bearer token",
      "content-type": "text/plain;charset=UTF-8",
      "x-custom": "value",
    });
    expect(forwardedRequest.cache).toBe("no-store");
    expect(forwardedRequest.credentials).toBe("include");
    expect(forwardedRequest.integrity).toBe("sha256-test");
    expect(forwardedRequest.mode).toBe("cors");
    expect(forwardedRequest.redirect).toBe("manual");
    expect(forwardedRequest.referrer).toBe("https://referrer.example.com/");
    expect(forwardedRequest.referrerPolicy).toBe("origin");
    expect(forwardedRequest.signal.aborted).toBe(false);
    expect(await forwardedRequest.text()).toBe("request body");

    abortController.abort();
    expect(forwardedRequest.signal.aborted).toBe(true);
  };

  describe("compose", () => {
    it("should handle empty transformer array", async () => {
      const composed = compose([]);
      await composed("https://api.example.com");
      expect(mockFetch).toHaveBeenCalledWith("https://api.example.com");
    });

    it("should compose multiple transformers", async () => {
      const composed = compose([method("POST"), json(), header("Authorization", "Bearer token")]);
      await composed("https://api.example.com");

      expect(mockFetch).toHaveBeenCalledWith("https://api.example.com", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer token",
        },
      });
    });
  });

  describe("method", () => {
    it("should preserve existing request options when setting method", async () => {
      const get = compose([method("PUT"), header("X-Custom", "value")]);
      await get("https://api.example.com");

      expect(mockFetch).toHaveBeenCalledWith("https://api.example.com", {
        method: "PUT",
        headers: expect.objectContaining({
          "x-custom": "value",
        }),
      });
    });

    it("should accept any RFC 9110 token as a method name", () => {
      expect(() => {
        return method("PATCH");
      }).not.toThrow();
      expect(() => {
        return method("X-CUSTOM_method.1");
      }).not.toThrow();
    });

    it.each([
      ["empty", ""],
      ["with a space", "GET /admin HTTP/1.1"],
      ["with a line feed", "GET\nX-Injected: 1"],
      ["with a carriage return", "GET\r\nX-Injected: 1"],
      ["with a NUL byte", "GET\u0000"],
      ["with a non-ASCII character", "GÉT"],
    ])("should reject a method name %s", (_label, name) => {
      expect(() => {
        return method(name);
      }).toThrow(TypeError);
    });
  });

  describe("header", () => {
    it("should handle multiple headers", async () => {
      const withHeaders = compose([
        header("Authorization", "Bearer token"),
        header("X-Custom", "value"),
      ]);
      await withHeaders("https://api.example.com");

      expect(mockFetch).toHaveBeenCalledWith("https://api.example.com", {
        headers: expect.objectContaining({
          authorization: "Bearer token",
          "x-custom": "value",
        }),
      });
    });

    it("should handle empty header values", async () => {
      const withHeaders = compose([header("X-Empty", "")]);
      await withHeaders("https://api.example.com");
      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.example.com",
        expect.objectContaining({
          headers: expect.objectContaining({ "x-empty": "" }),
        }),
      );
    });
  });

  describe("prefix", () => {
    it("should handle URLs with existing paths", async () => {
      const withPrefix = compose([prefix("https://example.com/api")]);
      await withPrefix("/users/123");

      expect(mockFetch).toHaveBeenCalledWith("https://example.com/api/users/123", undefined);
    });

    it("should preserve non-enumerable Request properties", async () => {
      await expectRequestUrlTransformToPreserveInit(
        prefix("/v1"),
        "https://api.example.com/v1/users?existing=true",
      );
    });
  });

  describe("query", () => {
    it("should preserve existing query parameters", async () => {
      const withQuery = compose([query({ sort: "desc" })]);
      await withQuery("https://api.example.com/users?page=1");

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("https://api.example.com/users?page=1&sort=desc"),
        undefined,
      );
    });

    it("should preserve non-enumerable Request properties", async () => {
      await expectRequestUrlTransformToPreserveInit(
        query({ page: "1" }),
        "https://api.example.com/users?existing=true&page=1",
      );
    });
  });

  describe("retry", () => {
    it("should treat maxRetries as retries after the initial attempt", async () => {
      mockFetch
        .mockRejectedValueOnce(new TypeError("Network error"))
        .mockRejectedValueOnce(new TypeError("Network error"))
        .mockRejectedValueOnce(new TypeError("Network error"))
        .mockResolvedValueOnce(new Response());

      const withRetry = compose([retry(3, 0)]);
      await withRetry("https://api.example.com");

      expect(mockFetch).toHaveBeenCalledTimes(4);
    });

    it("should throw after max retries", async () => {
      mockFetch.mockRejectedValue(new TypeError("Network error"));

      const withRetry = compose([retry(2, 0)]);
      await expect(withRetry("https://api.example.com")).rejects.toThrow("Network error");
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it("should retry with exponential backoff", async () => {
      vi.useFakeTimers();
      mockFetch
        .mockRejectedValueOnce(new TypeError("Network error"))
        .mockRejectedValueOnce(new TypeError("Network error"))
        .mockResolvedValueOnce(new Response());

      const withRetry = compose([
        retry(2, 100, (i) => {
          return Math.pow(2, i);
        }),
      ]);
      const response = withRetry("https://api.example.com");

      await vi.advanceTimersByTimeAsync(100);
      expect(mockFetch).toHaveBeenCalledTimes(2);
      await vi.advanceTimersByTimeAsync(200);

      await expect(response).resolves.toBeInstanceOf(Response);
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it("should retry 5xx responses by default", async () => {
      mockFetch
        .mockResolvedValueOnce(new Response("Unavailable", { status: 503 }))
        .mockResolvedValueOnce(new Response("Available", { status: 200 }));

      const withRetry = compose([retry(1, 0)]);
      const response = await withRetry("https://api.example.com");

      expect(response.status).toBe(200);
      expect(await response.text()).toBe("Available");
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("should bypass cached failures while retrying", async () => {
      mockFetch
        .mockResolvedValueOnce(new Response("Unavailable", { status: 503 }))
        .mockResolvedValueOnce(new Response("Available", { status: 200 }));

      const withRetryAndCache = compose([retry(1, 0), cache(1000)]);
      const response = await withRetryAndCache("https://api.example.com");

      expect(response.status).toBe(200);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("should not retry 4xx responses or parsing errors by default", async () => {
      mockFetch.mockResolvedValueOnce(new Response("Not Found", { status: 404 }));
      const withRetry = compose([retry(2, 0)]);

      const response = await withRetry("https://api.example.com/missing");

      expect(response.status).toBe(404);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      mockFetch.mockRejectedValueOnce(new SyntaxError("Unexpected token"));
      await expect(withRetry("https://api.example.com/json")).rejects.toThrow("Unexpected token");
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("should support a custom retry predicate", async () => {
      const shouldRetry = vi.fn((error: unknown, attempt: number) => {
        return error instanceof SyntaxError && attempt === 1;
      });
      mockFetch
        .mockRejectedValueOnce(new SyntaxError("Unexpected token"))
        .mockResolvedValueOnce(new Response());

      const withRetry = compose([retry(1, 0, 1, shouldRetry)]);
      await withRetry("https://api.example.com");

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(shouldRetry).toHaveBeenCalledWith(expect.any(SyntaxError), 1);
    });
  });

  describe("cache", () => {
    it("should only cache GET requests", async () => {
      const withCache = compose([method("POST"), cache(1000)]);
      await withCache("https://api.example.com");
      await withCache("https://api.example.com");

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("should respect cache max age", async () => {
      const withCache = compose([method("GET"), cache(100)]);

      await withCache("https://api.example.com");
      await new Promise((resolve) => {
        setTimeout(resolve, 150);
      });
      await withCache("https://api.example.com");

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("should cache non-JSON responses without changing response metadata", async () => {
      mockFetch.mockImplementation(async () => {
        return new Response("Partial content", {
          status: 206,
          statusText: "Partial Content",
          headers: { "Content-Type": "text/plain", "X-Response": "original" },
        });
      });
      const withCache = compose([cache(1000)]);

      const first = await withCache("https://api.example.com/plain");
      const second = await withCache("https://api.example.com/plain");

      expect(mockFetch).toHaveBeenCalledTimes(1);
      for (const response of [first, second]) {
        expect(response.status).toBe(206);
        expect(response.statusText).toBe("Partial Content");
        expect(response.ok).toBe(true);
        expect(response.headers.get("Content-Type")).toBe("text/plain");
        expect(response.headers.get("X-Response")).toBe("original");
        expect(await response.text()).toBe("Partial content");
      }
    });

    it("should preserve and not cache failed responses", async () => {
      mockFetch.mockImplementation(async () => {
        return new Response("Not Found", { status: 404, statusText: "Not Found" });
      });
      const withCache = compose([cache(1000)]);

      const first = await withCache("https://api.example.com/missing");
      const second = await withCache("https://api.example.com/missing");

      expect(mockFetch).toHaveBeenCalledTimes(2);
      for (const response of [first, second]) {
        expect(response.status).toBe(404);
        expect(response.statusText).toBe("Not Found");
        expect(response.ok).toBe(false);
        expect(await response.text()).toBe("Not Found");
      }
    });

    it("should include request headers in the cache key", async () => {
      mockFetch.mockImplementation(async () => {
        return new Response("cached");
      });
      const withCache = compose([cache(1000)]);

      await withCache("https://api.example.com/user", {
        headers: { Authorization: "Bearer first" },
      });
      await withCache("https://api.example.com/user", {
        headers: { Authorization: "Bearer first" },
      });
      await withCache("https://api.example.com/user", {
        headers: { Authorization: "Bearer second" },
      });

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("should evict the least recently used response at the entry limit", async () => {
      mockFetch.mockImplementation(async () => {
        return new Response("cached");
      });
      const withCache = compose([cache(1000, 1)]);

      await withCache("https://api.example.com/first");
      await withCache("https://api.example.com/second");
      await withCache("https://api.example.com/first");

      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it.each(["no-store", "no-cache", "private"])(
      "should not store responses with Cache-Control: %s",
      async (directive) => {
        mockFetch.mockImplementation(async () => {
          return new Response("private", { headers: { "Cache-Control": directive } });
        });
        const withCache = compose([cache(1000)]);

        await withCache("https://api.example.com/private");
        await withCache("https://api.example.com/private");

        expect(mockFetch).toHaveBeenCalledTimes(2);
      },
    );
  });

  describe("debug", () => {
    it("should call custom debug function with request params", async () => {
      const debugFn = vi.fn();
      const withDebug = compose([debug(debugFn)]);
      await withDebug("https://api.example.com", { method: "POST" });

      expect(debugFn).toHaveBeenCalledWith(["https://api.example.com", { method: "POST" }]);
    });
  });

  describe("createEndpoint", () => {
    it("should combine common and specific transformers", async () => {
      const endpoint = createEndpoint([
        prefix("https://api.example.com"),
        header("X-Common", "common"),
      ]);

      await endpoint("/users", [method("GET"), header("X-Specific", "specific")]);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.example.com/users",
        expect.objectContaining({
          method: "GET",
          headers: expect.objectContaining({
            "x-common": "common",
            "x-specific": "specific",
          }),
        }),
      );
    });
  });

  describe("Integration", () => {
    it("should handle complex transformer combinations", async () => {
      const endpoint = createEndpoint([
        prefix("https://api.example.com"),
        retry(3, 100),
        cache(1000),
        debug(console.log),
      ]);

      const result = await endpoint("/users", [method("GET"), query({ page: "1" }), json()]);

      expect(result).toEqual({ data: "test" });
    });
  });
});
