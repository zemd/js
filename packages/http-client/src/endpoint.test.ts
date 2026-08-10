import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { getRejection } from "@zemd/testing";
import { createEndpoint } from "./endpoint.ts";
import { fetchMock, addEndpointMock, clearEndpointMocks } from "./fetchMock.ts";
import type { TFetchTransformer } from "./type.ts";
import { json, method, prefix } from "./transformers.ts";

void describe("createEndpoint", () => {
  beforeEach(() => {
    clearEndpointMocks();
  });

  void describe("with json parsing", () => {
    void it("should create endpoint that returns parsed JSON response", async () => {
      const mockData = { message: "success", data: [1, 2, 3] };
      addEndpointMock("/api/test", "GET", () => {
        return mockData;
      });

      const endpoint = createEndpoint(
        [json(), prefix("https://example.com")],
        { parseResponse: "json" },
        fetchMock,
      );
      const result = await endpoint<typeof mockData>("/api/test", []);

      assert.deepStrictEqual(result, mockData);
    });

    void it("should apply transformers before making request", async () => {
      const mockData = { success: true };
      addEndpointMock("/api/transformed", "POST", () => {
        return mockData;
      });

      const methodTransformer: TFetchTransformer = async (fetchFn, url, options) => {
        return fetchFn(url, { ...options, method: "POST" });
      };

      const headerTransformer: TFetchTransformer = async (fetchFn, url, options) => {
        const headers = new Headers(options?.headers);
        headers.set("Content-Type", "application/json");

        return fetchFn(url, {
          ...options,
          headers,
        });
      };

      const endpoint = createEndpoint(
        [methodTransformer, json(), prefix("https://example.com")],
        { parseResponse: "json" },
        fetchMock,
      );
      const result = await endpoint<typeof mockData>("/api/transformed", [headerTransformer]);

      assert.deepStrictEqual(result, mockData);
    });

    void it("should throw error for non-ok responses", async () => {
      addEndpointMock("/api/error", "GET", () => {
        return new Response("Not Found", { status: 404 });
      });

      const endpoint = createEndpoint(
        [json(), prefix("https://example.com")],
        { parseResponse: "json" },
        fetchMock,
      );

      await assert.rejects(endpoint("/api/error", []), /HTTP error occur\. status: 404/);
    });
  });

  void describe("with text parsing", () => {
    void it("should create endpoint that returns text response", async () => {
      const textData = "Hello, World!";
      addEndpointMock("/api/text", "GET", () => {
        return new Response(textData, {
          headers: { "Content-Type": "text/plain" },
        });
      });

      const endpoint = createEndpoint(
        [prefix("https://example.com")],
        { parseResponse: "text" },
        fetchMock,
      );
      const result = await endpoint<string>("/api/text", []);

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
      addEndpointMock("/api/raw", "GET", () => {
        return responseData;
      });

      const endpoint = createEndpoint(
        [prefix("https://example.com")],
        { parseResponse: false },
        fetchMock,
      );
      const result = await endpoint("/api/raw", []);

      assert.ok(result instanceof Response);
      assert.strictEqual(result.status, 200);
    });
  });

  void describe("error handling", () => {
    void it("should include response in error cause for non-ok responses", async () => {
      const errorResponse = new Response("Server Error", { status: 500 });
      addEndpointMock("/api/server-error", "GET", () => {
        return errorResponse;
      });

      const endpoint = createEndpoint(
        [json(), prefix("https://example.com")],
        { parseResponse: "json" },
        fetchMock,
      );

      const error = await getRejection(endpoint("/api/server-error", []));
      assert.ok(error instanceof Error);
      if (!(error instanceof Error)) {
        throw new TypeError("expected the endpoint to reject with an Error");
      }
      assert.partialDeepStrictEqual(error.cause, { response: errorResponse });
    });

    void it("should handle JSON parsing errors gracefully", async () => {
      addEndpointMock("/api/invalid-json", "GET", () => {
        return new Response("invalid json{", {
          headers: { "Content-Type": "application/json" },
        });
      });

      const endpoint = createEndpoint(
        [json(), prefix("https://example.com")],
        { parseResponse: "json" },
        fetchMock,
      );

      await assert.rejects(endpoint("/api/invalid-json", []));
    });
  });

  void describe("transformer combination", () => {
    void it("should combine base transformers with endpoint transformers", async () => {
      const mockData = { combined: true };
      addEndpointMock("/api/combined", "PUT", () => {
        return mockData;
      });

      const baseTransformer: TFetchTransformer = async (fetchFn, url, options) => {
        return fetchFn(url, { ...options, method: "PUT" });
      };
      const endpointTransformer: TFetchTransformer = async (fetchFn, url, options) => {
        return fetchFn(url, { ...options, headers: { Authorization: "Bearer token" } });
      };

      const endpoint = createEndpoint(
        [baseTransformer, json(), prefix("https://example.com")],
        { parseResponse: "json" },
        fetchMock,
      );
      const result = await endpoint<typeof mockData>("/api/combined", [endpointTransformer]);

      assert.deepStrictEqual(result, mockData);
    });
  });

  void describe("default options", () => {
    void it("should use json parsing by default", async () => {
      const mockData = { default: true };
      addEndpointMock("/api/default", "GET", () => {
        return mockData;
      });

      const endpoint = createEndpoint(
        [json(), prefix("https://example.com")],
        undefined,
        fetchMock,
      );
      const result = await endpoint<typeof mockData>("/api/default", []);

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
      const endpoint = createEndpoint([]);
      const result = await endpoint<{ global: boolean }>("https://api.example.com/test", []);

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
      addEndpointMock("/raw", "GET", () => {
        return responseData;
      });

      const endpoint = createEndpoint(
        [prefix("https://example.com")],
        { parseResponse: false },
        fetchMock,
      );
      const result = await endpoint("/raw", []);

      assert.ok(result instanceof Response);
      assert.strictEqual(result.status, 200);
    });

    void it("should return Response object for 204 No Content regardless of parseResponse option", async () => {
      const noContentResponse = new Response(null, { status: 204 });
      addEndpointMock("/no-content", "DELETE", () => {
        return noContentResponse;
      });

      const jsonEndpoint = createEndpoint(
        [prefix("https://example.com"), method("DELETE")],
        { parseResponse: "json" },
        fetchMock,
      );
      const textEndpoint = createEndpoint(
        [prefix("https://example.com"), method("DELETE")],
        { parseResponse: "text" },
        fetchMock,
      );
      const rawEndpoint = createEndpoint(
        [prefix("https://example.com"), method("DELETE")],
        { parseResponse: false },
        fetchMock,
      );

      const jsonResult = await jsonEndpoint("/no-content", []);
      const textResult = await textEndpoint("/no-content", []);
      const rawResult = await rawEndpoint("/no-content", []);

      assert.ok(jsonResult instanceof Response);
      assert.strictEqual(jsonResult.status, 204);
      assert.ok(textResult instanceof Response);
      assert.strictEqual(textResult.status, 204);
      assert.ok(rawResult instanceof Response);
      assert.strictEqual(rawResult.status, 204);
    });
  });
});
