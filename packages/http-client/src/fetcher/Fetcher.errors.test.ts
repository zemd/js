/**
 * Public API coverage for diagnostics, response parsing, and error handling policies.
 *
 * @module fetcher/Fetcher.errors.test
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getRejection } from "@zemd/testing";
import { Fetcher, RequestTransformer, Retry, UrlTransformer, type HttpClient } from "../index.ts";

void describe("Fetcher error diagnostics", () => {
  void it("includes transformed request details, HTTP metadata, and a JSON error body", async () => {
    const body = { title: "Invalid input", errors: { name: "Required" } };
    const response = new Response(JSON.stringify(body), {
      status: 422,
      statusText: "Unprocessable Content",
      headers: { "Content-Type": "application/problem+json", "X-Request-Id": "trace-123" },
    });
    const fetcher = Fetcher.make(
      [UrlTransformer.prependPath("https://example.com"), RequestTransformer.setMethod("POST")],
      {},
      async () => response,
    );

    const error = await getRejection(fetcher("/users"));

    assert.ok(Fetcher.isError(error));
    assert.strictEqual(error.name, "Error");
    assert.strictEqual(error.cause.kind, "http");
    assert.deepStrictEqual(error.cause.request, {
      url: "https://example.com/users",
      method: "POST",
    });
    assert.strictEqual(error.cause.url, "https://example.com/users");
    assert.strictEqual(error.cause.method, "POST");
    assert.strictEqual(error.cause.status, 422);
    assert.strictEqual(error.cause.statusText, "Unprocessable Content");
    assert.strictEqual(error.cause.contentType, "application/problem+json");
    assert.strictEqual(error.cause.headers?.["x-request-id"], "trace-123");
    assert.deepStrictEqual(error.cause.body, body);
    assert.strictEqual(error.cause.rawBody, JSON.stringify(body));
    assert.strictEqual(error.cause.response, response);
    assert.strictEqual(response.bodyUsed, false);
    assert.deepStrictEqual(await response.json(), body);
    assert.match(error.message, /POST https:\/\/example.com\/users/);
    assert.match(error.message, /422 Unprocessable Content/);
  });

  void it("reports HTML HTTP failures without masking the status with a JSON error", async () => {
    const html = "<html>Bad gateway</html>";
    const response = new Response(html, { status: 502, headers: { "Content-Type": "text/html" } });
    const fetcher = Fetcher.make([], {}, async () => response);
    const error = await getRejection(fetcher("https://example.com"));

    assert.ok(Fetcher.isError(error));
    assert.strictEqual(error.cause.kind, "http");
    assert.strictEqual(error.cause.status, 502);
    assert.strictEqual(error.cause.body, html);
    assert.strictEqual(error.cause.rawBody, html);
    assert.strictEqual(error.cause.bodyError, undefined);
  });

  void it("keeps malformed JSON diagnostics without losing the HTTP failure", async () => {
    const response = new Response("{invalid", {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
    const fetcher = Fetcher.make([], {}, async () => response);
    const error = await getRejection(fetcher("https://example.com"));

    assert.ok(Fetcher.isError(error));
    assert.strictEqual(error.cause.kind, "http");
    assert.strictEqual(error.cause.status, 500);
    assert.strictEqual(error.cause.body, "{invalid");
    assert.ok(error.cause.bodyError instanceof SyntaxError);
    assert.strictEqual(response.bodyUsed, false);
  });

  void it("keeps the HTTP status when its body stream cannot be read", async () => {
    const failure = new Error("stream disconnected");
    const response = new Response(
      new ReadableStream({
        start(controller) {
          controller.error(failure);
        },
      }),
      { status: 503 },
    );
    const fetcher = Fetcher.make([], {}, async () => response);
    const error = await getRejection(fetcher("https://example.com"));

    assert.ok(Fetcher.isError(error));
    assert.strictEqual(error.cause.kind, "http");
    assert.strictEqual(error.cause.status, 503);
    assert.strictEqual(error.cause.bodyError, failure);
    assert.strictEqual(error.cause.rawBody, undefined);
    assert.strictEqual(error.cause.response, response);
  });

  void it("explains unexpected successful HTML responses and retains the text and original cause", async () => {
    const html = "<html>Sign in required</html>";
    const response = new Response(html, { headers: { "Content-Type": "text/html" } });
    const fetcher = Fetcher.make([], {}, async () => response);
    const error = await getRejection(fetcher("https://example.com/users"));

    assert.ok(Fetcher.isError(error));
    assert.strictEqual(error.cause.kind, "parse");
    assert.strictEqual(error.cause.status, 200);
    assert.strictEqual(error.cause.response, response);
    assert.strictEqual(error.cause.contentType, "text/html");
    assert.strictEqual(error.cause.rawBody, html);
    assert.strictEqual(error.cause.body, html);
    assert.ok(error.cause.originalError instanceof SyntaxError);
    assert.match(error.message, /json.*GET https:\/\/example.com\/users.*200.*text\/html/);
    assert.doesNotMatch(error.message, /Sign in required/);
  });

  void it("retains the original abort reason and final request metadata", async () => {
    const failure = new DOMException("Cancelled by caller", "AbortError");
    const fetcher = Fetcher.make(
      [UrlTransformer.prependPath("https://example.com"), RequestTransformer.setMethod("POST")],
      {},
      async () => {
        throw failure;
      },
    );
    const error = await getRejection(fetcher("/users", [RequestTransformer.setMethod("DELETE")]));

    assert.ok(Fetcher.isError(error));
    assert.strictEqual(error.cause.kind, "request");
    assert.strictEqual(error.cause.originalError, failure);
    assert.strictEqual(error.cause.method, "DELETE");
    assert.strictEqual(error.cause.url, "https://example.com/users");
    assert.strictEqual(error.cause.response, undefined);
  });

  void it("captures Request inputs forwarded by a transformer", async () => {
    const fetcher = Fetcher.make(
      [
        (next) =>
          next(new Request("https://example.com/rewritten", { method: "PUT" }), {
            method: "PATCH",
          }),
      ],
      {},
      async () => new Response("denied", { status: 403 }),
    );
    const error = await getRejection(fetcher("/original"));

    assert.ok(Fetcher.isError(error));
    assert.deepStrictEqual(error.cause.request, {
      url: "https://example.com/rewritten",
      method: "PATCH",
    });
  });

  void it("keeps context when a transformer returns a response without calling fetch", async () => {
    const fetcher = Fetcher.make(
      [
        UrlTransformer.prependPath("https://example.com"),
        RequestTransformer.setMethod("POST"),
        async () => new Response("local failure", { status: 500 }),
      ],
      {},
      async () => {
        throw new Error("fetch must not be called");
      },
    );
    const error = await getRejection(fetcher("/users"));

    assert.ok(Fetcher.isError(error));
    assert.deepStrictEqual(error.cause.request, {
      url: "https://example.com/users",
      method: "POST",
    });
  });

  void it("adds context to transformer failures", async () => {
    const failure = new Error("authentication unavailable");
    const fetcher = Fetcher.make([
      UrlTransformer.prependPath("https://example.com"),
      () => {
        throw failure;
      },
    ]);
    const error = await getRejection(fetcher("/users"));

    assert.ok(Fetcher.isError(error));
    assert.strictEqual(error.cause.kind, "request");
    assert.strictEqual(error.cause.originalError, failure);
    assert.strictEqual(error.cause.url, "https://example.com/users");
  });
});

void describe("Fetcher parsing controls", () => {
  void it("supports async custom parsers and independent per-request overrides", async () => {
    const fetcher = Fetcher.make(
      [],
      { parseResponse: "json" },
      async () => new Response('{"ok":true}'),
    );
    const parser: Fetcher.Parser = async (response) => ({ text: await response.text() });

    assert.deepStrictEqual(await fetcher("https://example.com", [], { parseResponse: parser }), {
      text: '{"ok":true}',
    });
    assert.strictEqual(
      await fetcher("https://example.com", [], { parseResponse: "text" }),
      '{"ok":true}',
    );
    assert.deepStrictEqual(await fetcher("https://example.com"), { ok: true });
    assert.ok(
      (await fetcher("https://example.com", [], { parseResponse: false })) instanceof Response,
    );
  });
});

void describe("Fetcher error handling controls", () => {
  void it("accepts a custom status per request without changing defaults", async () => {
    const fetcher = Fetcher.make([], {}, async () =>
      Response.json({ missing: true }, { status: 404 }),
    );
    assert.deepStrictEqual(
      await fetcher("https://example.com", [], {
        validateStatus: (status, response) =>
          status === 404 && response.headers.has("Content-Type"),
      }),
      { missing: true },
    );
    await assert.rejects(fetcher("https://example.com"), (error: unknown) => {
      assert.ok(Fetcher.isError(error));
      assert.strictEqual(error.cause.kind, "http");
      assert.strictEqual(error.cause.status, 404);
      return true;
    });
  });

  void it("can return any HTTP response without automatic status errors or parsing", async () => {
    const response = new Response("server error", { status: 500 });
    const fetcher = Fetcher.make(
      [],
      { parseResponse: false, validateStatus: () => true },
      async () => response,
    );
    assert.strictEqual(await fetcher("https://example.com"), response);
    assert.strictEqual(response.bodyUsed, false);
  });

  void it("notifies an async observer once and rejects with the same structured error", async (context) => {
    const onError = context.mock.fn<Fetcher.ErrorHandler>(async () => {
      await Promise.resolve();
    });
    const fetcher = Fetcher.make(
      [],
      { onError },
      async () => new Response("failure", { status: 500 }),
    );
    const error = await getRejection(fetcher("https://example.com"));

    assert.ok(Fetcher.isError(error));
    assert.strictEqual(onError.mock.callCount(), 1);
    assert.strictEqual(onError.mock.calls[0]?.arguments[0], error);
  });

  for (const fallback of [null, false, 0, "", { cached: true }]) {
    void it(`recovers with the fallback ${JSON.stringify(fallback)}`, async () => {
      const fetcher = Fetcher.make([], { onError: async () => fallback }, async () => {
        throw new TypeError("offline");
      });
      assert.strictEqual(await fetcher("https://example.com"), fallback);
    });
  }

  void it("allows mapping to a domain error without wrapping or calling the handler again", async (context) => {
    const domainError = new Error("Service unavailable");
    const onError = context.mock.fn<Fetcher.ErrorHandler>(async () => {
      throw domainError;
    });
    const fetcher = Fetcher.make([], { onError }, async () => new Response(null, { status: 503 }));

    assert.strictEqual(await getRejection(fetcher("https://example.com")), domainError);
    assert.strictEqual(onError.mock.callCount(), 1);
  });

  void it("can recover from unexpected content using the captured text", async () => {
    const fetcher = Fetcher.make(
      [],
      {
        onError: (error) => (error.cause.kind === "parse" ? error.cause.rawBody : undefined),
      },
      async () =>
        new Response("upstream maintenance", { headers: { "Content-Type": "text/plain" } }),
    );

    assert.strictEqual(await fetcher<string>("https://example.com"), "upstream maintenance");
  });

  void it("supports replacing or disabling an inherited error handler", async (context) => {
    const onError = context.mock.fn<Fetcher.ErrorHandler>(() => "global fallback");
    const fetcher = Fetcher.make(
      [],
      { onError },
      async () => new Response("failure", { status: 500 }),
    );

    assert.strictEqual(
      await fetcher<string>("https://example.com", [], { onError: () => "local fallback" }),
      "local fallback",
    );
    await assert.rejects(fetcher("https://example.com", [], { onError: null }), Fetcher.isError);
    assert.strictEqual(onError.mock.callCount(), 0);
    assert.strictEqual(await fetcher<string>("https://example.com"), "global fallback");
    assert.strictEqual(onError.mock.callCount(), 1);
  });

  void it("does not interfere with transport retries and handles only the final failure", async (context) => {
    const failure = new TypeError("offline");
    const fetch = context.mock.fn<HttpClient.Type>(async () => {
      throw failure;
    });
    const onError = context.mock.fn<Fetcher.ErrorHandler>(() => undefined);
    const fetcher = Fetcher.make([Retry.make(2, 0)], { onError }, fetch);
    const error = await getRejection(fetcher("https://example.com"));

    assert.ok(Fetcher.isError(error));
    assert.strictEqual(error.cause.originalError, failure);
    assert.strictEqual(fetch.mock.callCount(), 3);
    assert.strictEqual(onError.mock.callCount(), 1);
  });

  void it("isolates metadata between concurrent requests", async () => {
    const fetcher = Fetcher.make(
      [UrlTransformer.prependPath("https://example.com")],
      {},
      async () => {
        await Promise.resolve();
        throw new TypeError("offline");
      },
    );
    const errors = await Promise.all([
      getRejection(fetcher("/first", [RequestTransformer.setMethod("POST")])),
      getRejection(fetcher("/second", [RequestTransformer.setMethod("DELETE")])),
    ]);

    assert.deepStrictEqual(
      errors.map((error) => {
        assert.ok(Fetcher.isError(error));
        return error.cause.request;
      }),
      [
        { url: "https://example.com/first", method: "POST" },
        { url: "https://example.com/second", method: "DELETE" },
      ],
    );
  });
});
