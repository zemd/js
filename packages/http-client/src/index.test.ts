import assert from "node:assert/strict";
import { beforeEach, describe, it, type Mock } from "node:test";
import { advanceTimersByTime, mockImplementationSequence } from "@zemd/testing";
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
} from "./index.ts";
import type { TFetchTransformer } from "./type.ts";

void describe("HTTP Client", () => {
  let mockFetch: Mock<typeof fetch>;

  beforeEach((context) => {
    if (!("mock" in context)) {
      throw new TypeError("beforeEach must run with a test context");
    }
    mockFetch = context.mock.method(globalThis, "fetch", async (): Promise<Response> => {
      return Response.json(
        { data: "test" },
        {
          headers: { "Content-Type": "application/json" },
        },
      );
    });
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
      assert.strictEqual(Object.prototype.propertyIsEnumerable.call(request, property), false);
    }

    await compose([transformer])(request);

    const [forwarded, init] = mockFetch.mock.calls[0]?.arguments ?? [];
    assert.ok(forwarded instanceof Request);
    assert.strictEqual(init, undefined);

    const forwardedRequest = forwarded as Request;
    assert.strictEqual(forwardedRequest.url, expectedUrl);
    assert.strictEqual(forwardedRequest.method, "POST");
    assert.deepStrictEqual(Object.fromEntries(forwardedRequest.headers.entries()), {
      authorization: "Bearer token",
      "content-type": "text/plain;charset=UTF-8",
      "x-custom": "value",
    });
    assert.strictEqual(forwardedRequest.cache, "no-store");
    assert.strictEqual(forwardedRequest.credentials, "include");
    assert.strictEqual(forwardedRequest.integrity, "sha256-test");
    assert.strictEqual(forwardedRequest.mode, "cors");
    assert.strictEqual(forwardedRequest.redirect, "manual");
    assert.strictEqual(forwardedRequest.referrer, "https://referrer.example.com/");
    assert.strictEqual(forwardedRequest.referrerPolicy, "origin");
    assert.strictEqual(forwardedRequest.signal.aborted, false);
    assert.strictEqual(await forwardedRequest.text(), "request body");

    abortController.abort();
    assert.strictEqual(forwardedRequest.signal.aborted, true);
  };

  void describe("compose", () => {
    void it("should handle empty transformer array", async () => {
      const composed = compose([]);
      await composed("https://api.example.com");
      assert.deepStrictEqual(mockFetch.mock.calls[0]?.arguments, ["https://api.example.com"]);
    });

    void it("should compose multiple transformers", async () => {
      const composed = compose([method("POST"), json(), header("Authorization", "Bearer token")]);
      await composed("https://api.example.com");

      assert.deepStrictEqual(mockFetch.mock.calls[0]?.arguments, [
        "https://api.example.com",
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: "Bearer token",
          },
        },
      ]);
    });
  });

  void describe("method", () => {
    void it("should preserve existing request options when setting method", async () => {
      const get = compose([method("PUT"), header("X-Custom", "value")]);
      await get("https://api.example.com");

      assert.partialDeepStrictEqual(mockFetch.mock.calls[0]?.arguments, [
        "https://api.example.com",
        {
          method: "PUT",
          headers: {
            "x-custom": "value",
          },
        },
      ]);
    });

    void it("should accept any RFC 9110 token as a method name", () => {
      assert.doesNotThrow(() => {
        return method("PATCH");
      });
      assert.doesNotThrow(() => {
        return method("X-CUSTOM_method.1");
      });
    });

    void it("should reject invalid method names", () => {
      for (const [label, name] of [
        ["empty", ""],
        ["with a space", "GET /admin HTTP/1.1"],
        ["with a line feed", "GET\nX-Injected: 1"],
        ["with a carriage return", "GET\r\nX-Injected: 1"],
        ["with a NUL byte", "GET\u0000"],
        ["with a non-ASCII character", "GÉT"],
      ] as const) {
        assert.throws(
          () => {
            return method(name);
          },
          TypeError,
          `method name ${label}`,
        );
      }
    });
  });

  void describe("header", () => {
    void it("should handle multiple headers", async () => {
      const withHeaders = compose([
        header("Authorization", "Bearer token"),
        header("X-Custom", "value"),
      ]);
      await withHeaders("https://api.example.com");

      assert.partialDeepStrictEqual(mockFetch.mock.calls[0]?.arguments, [
        "https://api.example.com",
        {
          headers: {
            authorization: "Bearer token",
            "x-custom": "value",
          },
        },
      ]);
    });

    void it("should handle empty header values", async () => {
      const withHeaders = compose([header("X-Empty", "")]);
      await withHeaders("https://api.example.com");
      assert.partialDeepStrictEqual(mockFetch.mock.calls[0]?.arguments, [
        "https://api.example.com",
        {
          headers: { "x-empty": "" },
        },
      ]);
    });
  });

  void describe("prefix", () => {
    void it("should handle URLs with existing paths", async () => {
      const withPrefix = compose([prefix("https://example.com/api")]);
      await withPrefix("/users/123");

      assert.deepStrictEqual(mockFetch.mock.calls[0]?.arguments, [
        "https://example.com/api/users/123",
        undefined,
      ]);
    });

    void it("should preserve non-enumerable Request properties", async () => {
      await expectRequestUrlTransformToPreserveInit(
        prefix("/v1"),
        "https://api.example.com/v1/users?existing=true",
      );
    });
  });

  void describe("query", () => {
    void it("should preserve existing query parameters", async () => {
      const withQuery = compose([query({ sort: "desc" })]);
      await withQuery("https://api.example.com/users?page=1");

      const [input, init] = mockFetch.mock.calls[0]?.arguments ?? [];
      assert.ok(
        typeof input === "string" &&
          input.includes("https://api.example.com/users?page=1&sort=desc"),
      );
      assert.strictEqual(init, undefined);
    });

    void it("should preserve non-enumerable Request properties", async () => {
      await expectRequestUrlTransformToPreserveInit(
        query({ page: "1" }),
        "https://api.example.com/users?existing=true&page=1",
      );
    });
  });

  void describe("retry", () => {
    void it("should treat maxRetries as retries after the initial attempt", async () => {
      mockImplementationSequence(mockFetch, [
        async () => {
          throw new TypeError("Network error");
        },
        async () => {
          throw new TypeError("Network error");
        },
        async () => {
          throw new TypeError("Network error");
        },
        async () => new Response(),
      ]);

      const withRetry = compose([retry(3, 0)]);
      await withRetry("https://api.example.com");

      assert.strictEqual(mockFetch.mock.callCount(), 4);
    });

    void it("should throw after max retries", async () => {
      mockFetch.mock.mockImplementation(async () => {
        throw new TypeError("Network error");
      });

      const withRetry = compose([retry(2, 0)]);
      await assert.rejects(withRetry("https://api.example.com"), /Network error/);
      assert.strictEqual(mockFetch.mock.callCount(), 3);
    });

    void it("should retry with exponential backoff", async (context) => {
      context.mock.timers.enable({ apis: ["setTimeout"] });
      mockImplementationSequence(mockFetch, [
        async () => {
          throw new TypeError("Network error");
        },
        async () => {
          throw new TypeError("Network error");
        },
        async () => new Response(),
      ]);

      const withRetry = compose([
        retry(2, 100, (i) => {
          return Math.pow(2, i);
        }),
      ]);
      const response = withRetry("https://api.example.com");

      await advanceTimersByTime(context.mock.timers, 100);
      assert.strictEqual(mockFetch.mock.callCount(), 2);
      await advanceTimersByTime(context.mock.timers, 200);

      assert.ok((await response) instanceof Response);
      assert.strictEqual(mockFetch.mock.callCount(), 3);
    });

    void it("should retry 5xx responses by default", async () => {
      mockImplementationSequence(mockFetch, [
        async () => new Response("Unavailable", { status: 503 }),
        async () => new Response("Available", { status: 200 }),
      ]);

      const withRetry = compose([retry(1, 0)]);
      const response = await withRetry("https://api.example.com");

      assert.strictEqual(response.status, 200);
      assert.strictEqual(await response.text(), "Available");
      assert.strictEqual(mockFetch.mock.callCount(), 2);
    });

    void it("should bypass cached failures while retrying", async () => {
      mockImplementationSequence(mockFetch, [
        async () => new Response("Unavailable", { status: 503 }),
        async () => new Response("Available", { status: 200 }),
      ]);

      const withRetryAndCache = compose([retry(1, 0), cache(1000)]);
      const response = await withRetryAndCache("https://api.example.com");

      assert.strictEqual(response.status, 200);
      assert.strictEqual(mockFetch.mock.callCount(), 2);
    });

    void it("should not retry 4xx responses or parsing errors by default", async () => {
      mockImplementationSequence(mockFetch, [
        async () => new Response("Not Found", { status: 404 }),
      ]);
      const withRetry = compose([retry(2, 0)]);

      const response = await withRetry("https://api.example.com/missing");

      assert.strictEqual(response.status, 404);
      assert.strictEqual(mockFetch.mock.callCount(), 1);

      mockImplementationSequence(mockFetch, [
        async () => {
          throw new SyntaxError("Unexpected token");
        },
      ]);
      await assert.rejects(withRetry("https://api.example.com/json"), /Unexpected token/);
      assert.strictEqual(mockFetch.mock.callCount(), 2);
    });

    void it("should support a custom retry predicate", async (context) => {
      const shouldRetry = context.mock.fn((error: unknown, attempt: number) => {
        return error instanceof SyntaxError && attempt === 1;
      });
      mockImplementationSequence(mockFetch, [
        async () => {
          throw new SyntaxError("Unexpected token");
        },
        async () => new Response(),
      ]);

      const withRetry = compose([retry(1, 0, 1, shouldRetry)]);
      await withRetry("https://api.example.com");

      assert.strictEqual(mockFetch.mock.callCount(), 2);
      assert.ok(
        shouldRetry.mock.calls.some(
          ({ arguments: [error, attempt] }) => error instanceof SyntaxError && attempt === 1,
        ),
      );
    });
  });

  void describe("cache", () => {
    void it("should only cache GET requests", async () => {
      const withCache = compose([method("POST"), cache(1000)]);
      await withCache("https://api.example.com");
      await withCache("https://api.example.com");

      assert.strictEqual(mockFetch.mock.callCount(), 2);
    });

    void it("should respect cache max age", async () => {
      const withCache = compose([method("GET"), cache(100)]);

      await withCache("https://api.example.com");
      await new Promise((resolve) => {
        setTimeout(resolve, 150);
      });
      await withCache("https://api.example.com");

      assert.strictEqual(mockFetch.mock.callCount(), 2);
    });

    void it("should cache non-JSON responses without changing response metadata", async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response("Partial content", {
          status: 206,
          statusText: "Partial Content",
          headers: { "Content-Type": "text/plain", "X-Response": "original" },
        });
      });
      const withCache = compose([cache(1000)]);

      const first = await withCache("https://api.example.com/plain");
      const second = await withCache("https://api.example.com/plain");

      assert.strictEqual(mockFetch.mock.callCount(), 1);
      for (const response of [first, second]) {
        assert.strictEqual(response.status, 206);
        assert.strictEqual(response.statusText, "Partial Content");
        assert.strictEqual(response.ok, true);
        assert.strictEqual(response.headers.get("Content-Type"), "text/plain");
        assert.strictEqual(response.headers.get("X-Response"), "original");
        assert.strictEqual(await response.text(), "Partial content");
      }
    });

    void it("should preserve and not cache failed responses", async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response("Not Found", { status: 404, statusText: "Not Found" });
      });
      const withCache = compose([cache(1000)]);

      const first = await withCache("https://api.example.com/missing");
      const second = await withCache("https://api.example.com/missing");

      assert.strictEqual(mockFetch.mock.callCount(), 2);
      for (const response of [first, second]) {
        assert.strictEqual(response.status, 404);
        assert.strictEqual(response.statusText, "Not Found");
        assert.strictEqual(response.ok, false);
        assert.strictEqual(await response.text(), "Not Found");
      }
    });

    void it("should include request headers in the cache key", async () => {
      mockFetch.mock.mockImplementation(async () => {
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

      assert.strictEqual(mockFetch.mock.callCount(), 2);
    });

    void it("should evict the least recently used response at the entry limit", async () => {
      mockFetch.mock.mockImplementation(async () => {
        return new Response("cached");
      });
      const withCache = compose([cache(1000, 1)]);

      await withCache("https://api.example.com/first");
      await withCache("https://api.example.com/second");
      await withCache("https://api.example.com/first");

      assert.strictEqual(mockFetch.mock.callCount(), 3);
    });

    void it("should not store responses with restrictive Cache-Control directives", async () => {
      for (const directive of ["no-store", "no-cache", "private"] as const) {
        mockFetch.mock.mockImplementation(async () => {
          return new Response("private", { headers: { "Cache-Control": directive } });
        });
        const callsBeforeRequest = mockFetch.mock.callCount();
        const withCache = compose([cache(1000)]);

        await withCache("https://api.example.com/private");
        await withCache("https://api.example.com/private");

        assert.strictEqual(
          mockFetch.mock.callCount() - callsBeforeRequest,
          2,
          `Cache-Control: ${directive}`,
        );
      }
    });
  });

  void describe("debug", () => {
    void it("should call custom debug function with request params", async (context) => {
      const debugFn = context.mock.fn();
      const withDebug = compose([debug(debugFn)]);
      await withDebug("https://api.example.com", { method: "POST" });

      assert.deepStrictEqual(debugFn.mock.calls[0]?.arguments, [
        ["https://api.example.com", { method: "POST" }],
      ]);
    });
  });

  void describe("createEndpoint", () => {
    void it("should combine common and specific transformers", async () => {
      const endpoint = createEndpoint([
        prefix("https://api.example.com"),
        header("X-Common", "common"),
      ]);

      await endpoint("/users", [method("GET"), header("X-Specific", "specific")]);

      assert.partialDeepStrictEqual(mockFetch.mock.calls[0]?.arguments, [
        "https://api.example.com/users",
        {
          method: "GET",
          headers: {
            "x-common": "common",
            "x-specific": "specific",
          },
        },
      ]);
    });
  });

  void describe("Integration", () => {
    void it("should handle complex transformer combinations", async (context) => {
      const debugFn = context.mock.fn();
      const endpoint = createEndpoint([
        prefix("https://api.example.com"),
        retry(3, 100),
        cache(1000),
        debug(debugFn),
      ]);

      const result = await endpoint("/users", [method("GET"), query({ page: "1" }), json()]);

      assert.deepStrictEqual(result, { data: "test" });
      assert.ok(debugFn.mock.callCount() > 0);
    });
  });
});
