/**
 * Tests for API client composition, response parsing, and error propagation.
 *
 * @module fetcher/Fetcher.test
 */

import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { getRejection } from "@zemd/testing";
import {
  Fetcher,
  FetchMock,
  RequestTransformer,
  UrlTransformer,
  type HttpClient,
} from "../index.ts";

void describe("Fetcher.make", () => {
  beforeEach(() => {
    FetchMock.clear();
  });

  void describe("with json parsing", () => {
    void it("sends QUERY content and parses the mocked response", async (context) => {
      const body = JSON.stringify({ name: "Ada" });
      const users = [{ name: "Ada" }];
      const implementation = context.mock.fn<FetchMock.Implementation>(() => users);
      FetchMock.register("/users", "QUERY", implementation);
      const fetcher = Fetcher.make(
        [UrlTransformer.prependPath("https://example.com")],
        undefined,
        FetchMock.fetch,
      );

      const result = await fetcher<typeof users>("/users", [
        RequestTransformer.setMethod("QUERY"),
        RequestTransformer.jsonContentType(),
        RequestTransformer.setBody(body),
      ]);

      assert.deepStrictEqual(result, users);
      assert.strictEqual(implementation.mock.callCount(), 1);
      const call = implementation.mock.calls[0];
      assert.ok(call);
      const request = new Request(...call.arguments);
      assert.strictEqual(request.url, "https://example.com/users");
      assert.strictEqual(request.method, "QUERY");
      assert.strictEqual(request.headers.get("Content-Type"), "application/json");
      assert.strictEqual(await request.text(), body);
    });

    void it("should create an API client that returns parsed JSON response", async () => {
      const mockData = { message: "success", data: [1, 2, 3] };
      FetchMock.register("/api/test", "GET", () => {
        return mockData;
      });

      const fetcher = Fetcher.make(
        [RequestTransformer.jsonContentType(), UrlTransformer.prependPath("https://example.com")],
        { parseResponse: "json" },
        FetchMock.fetch,
      );
      const result = await fetcher<typeof mockData>("/api/test", []);

      assert.deepStrictEqual(result, mockData);
    });

    void it("should apply transformers before making request", async () => {
      const mockData = { success: true };
      FetchMock.register("/api/transformed", "POST", () => {
        return mockData;
      });

      const methodTransformer: HttpClient.Transformer = async (fetchFn, url, options) => {
        return fetchFn(url, { ...options, method: "POST" });
      };

      const headerTransformer: HttpClient.Transformer = async (fetchFn, url, options) => {
        const headers = new Headers(options?.headers);
        headers.set("Content-Type", "application/json");

        return fetchFn(url, {
          ...options,
          headers,
        });
      };

      const fetcher = Fetcher.make(
        [
          methodTransformer,
          RequestTransformer.jsonContentType(),
          UrlTransformer.prependPath("https://example.com"),
        ],
        { parseResponse: "json" },
        FetchMock.fetch,
      );
      const result = await fetcher<typeof mockData>("/api/transformed", [headerTransformer]);

      assert.deepStrictEqual(result, mockData);
    });

    void it("should throw error for non-ok responses", async () => {
      FetchMock.register("/api/error", "GET", () => {
        return new Response("Not Found", { status: 404 });
      });

      const fetcher = Fetcher.make(
        [RequestTransformer.jsonContentType(), UrlTransformer.prependPath("https://example.com")],
        { parseResponse: "json" },
        FetchMock.fetch,
      );

      await assert.rejects(
        fetcher("/api/error", []),
        /HTTP error: GET https:\/\/example.com\/api\/error \(status: 404/,
      );
    });
  });

  void describe("with text parsing", () => {
    void it("should create an API client that returns text response", async () => {
      const textData = "Hello, World!";
      FetchMock.register("/api/text", "GET", () => {
        return new Response(textData, {
          headers: { "Content-Type": "text/plain" },
        });
      });

      const fetcher = Fetcher.make(
        [UrlTransformer.prependPath("https://example.com")],
        { parseResponse: "text" },
        FetchMock.fetch,
      );
      const result = await fetcher<string>("/api/text", []);

      assert.strictEqual(result, textData);
    });
  });

  void describe("with no parsing", () => {
    void it("should return raw Response object", async () => {
      const responseData = Response.json(
        { test: true },
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
      FetchMock.register("/api/raw", "GET", () => {
        return responseData;
      });

      const fetcher = Fetcher.make(
        [UrlTransformer.prependPath("https://example.com")],
        { parseResponse: false },
        FetchMock.fetch,
      );
      const result = await fetcher("/api/raw", []);

      assert.ok(result instanceof Response);
      assert.strictEqual(result.status, 200);
    });
  });

  void describe("error handling", () => {
    void it("should include response in error cause for non-ok responses", async () => {
      const errorResponse = new Response("Server Error", { status: 500 });
      FetchMock.register("/api/server-error", "GET", () => {
        return errorResponse;
      });

      const fetcher = Fetcher.make(
        [RequestTransformer.jsonContentType(), UrlTransformer.prependPath("https://example.com")],
        { parseResponse: "json" },
        FetchMock.fetch,
      );

      const error = await getRejection(fetcher("/api/server-error", []));
      assert.ok(Fetcher.isError(error));
      assert.strictEqual(error.cause.response, errorResponse);
    });

    void it("should handle JSON parsing errors gracefully", async () => {
      FetchMock.register("/api/invalid-json", "GET", () => {
        return new Response("invalid json{", {
          headers: { "Content-Type": "application/json" },
        });
      });

      const fetcher = Fetcher.make(
        [RequestTransformer.jsonContentType(), UrlTransformer.prependPath("https://example.com")],
        { parseResponse: "json" },
        FetchMock.fetch,
      );

      await assert.rejects(fetcher("/api/invalid-json", []));
    });
  });

  void describe("transformer combination", () => {
    void it("applies readonly common transformers before per-request overrides without leaking them", async (context) => {
      const common = Object.freeze([
        RequestTransformer.setMethod("GET"),
        RequestTransformer.appendHeader("X-Trace", "common"),
      ]);
      const perRequest = Object.freeze([
        RequestTransformer.setMethod("POST"),
        RequestTransformer.appendHeader("X-Trace", "request"),
      ]);
      const fetch = context.mock.fn(async (..._params: HttpClient.Params) =>
        Response.json({ ok: true }),
      );
      const api: Fetcher.Type = Fetcher.make(common, undefined, fetch);

      await api("https://example.com/first", perRequest);
      await api("https://example.com/second", Object.freeze([]));

      assert.strictEqual(fetch.mock.callCount(), 2);
      const first = fetch.mock.calls[0]?.arguments[1];
      const second = fetch.mock.calls[1]?.arguments[1];
      assert.strictEqual(first?.method, "POST");
      assert.strictEqual(new Headers(first?.headers).get("X-Trace"), "common, request");
      assert.strictEqual(second?.method, "GET");
      assert.strictEqual(new Headers(second?.headers).get("X-Trace"), "common");
      assert.strictEqual(common.length, 2);
      assert.strictEqual(perRequest.length, 2);
    });

    void it("should combine base transformers with per-request transformers", async () => {
      const mockData = { combined: true };
      FetchMock.register("/api/combined", "PUT", () => {
        return mockData;
      });

      const baseTransformer: HttpClient.Transformer = async (fetchFn, url, options) => {
        return fetchFn(url, { ...options, method: "PUT" });
      };
      const requestTransformer: HttpClient.Transformer = async (fetchFn, url, options) => {
        return fetchFn(url, { ...options, headers: { Authorization: "Bearer token" } });
      };

      const fetcher = Fetcher.make(
        [
          baseTransformer,
          RequestTransformer.jsonContentType(),
          UrlTransformer.prependPath("https://example.com"),
        ],
        { parseResponse: "json" },
        FetchMock.fetch,
      );
      const result = await fetcher<typeof mockData>("/api/combined", [requestTransformer]);

      assert.deepStrictEqual(result, mockData);
    });
  });

  void describe("default options", () => {
    void it("should use json parsing by default", async () => {
      const mockData = { default: true };
      FetchMock.register("/api/default", "GET", () => {
        return mockData;
      });

      const fetcher = Fetcher.make(
        [RequestTransformer.jsonContentType(), UrlTransformer.prependPath("https://example.com")],
        undefined,
        FetchMock.fetch,
      );
      const result = await fetcher<typeof mockData>("/api/default", []);

      assert.deepStrictEqual(result, mockData);
    });

    void it("should use global fetch by default when no fetchFn provided", async (context) => {
      const globalFetch = context.mock.method(globalThis, "fetch", async () =>
        Response.json(
          { global: true },
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      );
      const fetcher = Fetcher.make([]);
      const result = await fetcher<{ global: boolean }>("https://api.example.com/test", []);

      assert.deepStrictEqual(globalFetch.mock.calls[0]?.arguments, [
        "https://api.example.com/test",
      ]);
      assert.deepStrictEqual(result, { global: true });
    });
  });

  void describe("with no parsing", () => {
    void it("should return raw Response object", async () => {
      const responseData = Response.json(
        { test: true },
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
      FetchMock.register("/raw", "GET", () => {
        return responseData;
      });

      const fetcher = Fetcher.make(
        [UrlTransformer.prependPath("https://example.com")],
        { parseResponse: false },
        FetchMock.fetch,
      );
      const result = await fetcher("/raw", []);

      assert.ok(result instanceof Response);
      assert.strictEqual(result.status, 200);
    });

    void it("should return Response object for 204 No Content regardless of parseResponse option", async () => {
      const noContentResponse = new Response(null, { status: 204 });
      FetchMock.register("/no-content", "DELETE", () => {
        return noContentResponse;
      });

      const jsonClient = Fetcher.make(
        [UrlTransformer.prependPath("https://example.com"), RequestTransformer.setMethod("DELETE")],
        { parseResponse: "json" },
        FetchMock.fetch,
      );
      const textClient = Fetcher.make(
        [UrlTransformer.prependPath("https://example.com"), RequestTransformer.setMethod("DELETE")],
        { parseResponse: "text" },
        FetchMock.fetch,
      );
      const rawClient = Fetcher.make(
        [UrlTransformer.prependPath("https://example.com"), RequestTransformer.setMethod("DELETE")],
        { parseResponse: false },
        FetchMock.fetch,
      );

      const jsonResult = await jsonClient("/no-content", []);
      const textResult = await textClient("/no-content", []);
      const rawResult = await rawClient("/no-content", []);

      assert.ok(jsonResult instanceof Response);
      assert.strictEqual(jsonResult.status, 204);
      assert.ok(textResult instanceof Response);
      assert.strictEqual(textResult.status, 204);
      assert.ok(rawResult instanceof Response);
      assert.strictEqual(rawResult.status, 204);
    });
  });
});

void describe("Fetcher.make response failures", () => {
  for (const parseResponse of [
    "json",
    "text",
    false,
  ] as const satisfies ReadonlyArray<Fetcher.ParseMode>) {
    void it(`preserves the failed response and unread body with parseResponse=${parseResponse}`, async () => {
      const response = new Response("failure details", { status: 422 });
      const options: Fetcher.Options = Object.freeze({ parseResponse });
      const fetcher = Fetcher.make([], options, async () => response);

      const error = await getRejection(fetcher("https://example.com", []));

      assert.ok(Fetcher.isError(error));
      assert.match(error.message, /status: 422/);
      assert.strictEqual(error.cause.response, response);
      assert.strictEqual(response.bodyUsed, false);
      assert.strictEqual(await response.text(), "failure details");
    });
  }

  void it("retains transport failures as the cause of a request error", async () => {
    const failure = new TypeError("connection failed");
    const fetcher = Fetcher.make([], undefined, async () => {
      throw failure;
    });

    await assert.rejects(fetcher("https://example.com", []), (error: unknown) => {
      assert.ok(Fetcher.isError(error));
      assert.strictEqual(error.cause.kind, "request");
      assert.strictEqual(error.cause.originalError, failure);
      assert.strictEqual(error.cause.response, undefined);
      return true;
    });
  });

  for (const parseResponse of ["json", "text"] as const) {
    void it(`retains ${parseResponse} body read failures as the cause of a parse error`, async () => {
      const failure = new Error("stream failed");
      const response = new Response(
        new ReadableStream({
          start(controller) {
            controller.error(failure);
          },
        }),
      );
      const fetcher = Fetcher.make([], { parseResponse }, async () => response);

      await assert.rejects(fetcher("https://example.com", []), (error: unknown) => {
        assert.ok(Fetcher.isError(error));
        assert.strictEqual(error.cause.kind, "parse");
        assert.strictEqual(error.cause.originalError, failure);
        assert.strictEqual(error.cause.response, response);
        assert.strictEqual(error.cause.rawBody, undefined);
        return true;
      });
    });
  }

  void it("returns the original unconsumed response when parsing is disabled", async () => {
    const response = new Response("raw response", { status: 201 });
    const fetcher = Fetcher.make([], { parseResponse: false }, async () => response);

    const result = await fetcher("https://example.com", []);

    assert.strictEqual(result, response);
    assert.strictEqual(result.bodyUsed, false);
    assert.strictEqual(await result.text(), "raw response");
  });
});
