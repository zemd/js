/**
 * Unit tests for native error causes and structured logging.
 *
 * @module fetcher/FetcherError.test
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as FetcherError from "./FetcherError.ts";

const request = { url: "https://example.com/users", method: "POST" };

void describe("FetcherError.make", () => {
  void it("uses the native Error prototype and puts diagnostics in cause", () => {
    const original = new TypeError("connection failed");
    const error = FetcherError.make("Request failed", {
      kind: "request",
      request,
      originalError: original,
    });

    assert.strictEqual(Object.getPrototypeOf(error), Error.prototype);
    assert.strictEqual(error.constructor, Error);
    assert.strictEqual(error.name, "Error");
    assert.strictEqual(error.message, "Request failed");
    assert.ok(error.stack?.includes("Request failed"));
    assert.strictEqual(Object.getOwnPropertyDescriptor(error, "cause")?.enumerable, false);
    assert.strictEqual("kind" in error, false);
    assert.strictEqual(error.cause.source, "@zemd/http-client");
    assert.strictEqual(error.cause.kind, "request");
    assert.strictEqual(error.cause.originalError, original);
    assert.deepStrictEqual(error.cause.request, request);
    assert.strictEqual(error.cause.status, undefined);
    assert.strictEqual(error.cause.response, undefined);
  });

  void it("snapshots response metadata while preserving the original unread response", async () => {
    const response = new Response("failure", {
      status: 503,
      statusText: "Unavailable",
      headers: { "X-Request-Id": "trace-1" },
    });
    Object.defineProperty(response, "url", { value: "https://example.com/redirected" });
    const error = FetcherError.make("HTTP failure", { kind: "http", request, response });
    response.headers.set("X-Request-Id", "changed");

    assert.strictEqual(error.cause.url, "https://example.com/redirected");
    assert.strictEqual(error.cause.request.url, request.url);
    assert.strictEqual(error.cause.method, "POST");
    assert.strictEqual(error.cause.status, 503);
    assert.strictEqual(error.cause.statusText, "Unavailable");
    assert.strictEqual(error.cause.contentType, "text/plain;charset=UTF-8");
    assert.strictEqual(error.cause.headers?.["x-request-id"], "trace-1");
    assert.strictEqual(error.cause.response, response);
    assert.strictEqual(response.bodyUsed, false);
    assert.strictEqual(await response.text(), "failure");
  });
});

void describe("FetcherError.isError", () => {
  void it("narrows native API errors without a custom constructor", () => {
    const value: unknown = FetcherError.make("failure", { kind: "request", request });
    assert.ok(FetcherError.isError(value));
    assert.strictEqual(value.cause.kind, "request");
  });

  void it("rejects unrelated and incomplete errors", () => {
    for (const value of [
      undefined,
      null,
      "failure",
      {},
      new Error("unrelated"),
      new Error("partial", { cause: { source: "@zemd/http-client" } }),
      new Error("wrong kind", { cause: { source: "@zemd/http-client", kind: "other", request } }),
    ]) {
      assert.strictEqual(FetcherError.isError(value), false);
    }
  });
});

void describe("FetcherError structured logging", () => {
  void it("serializes name, message, stack, HTTP fields, headers, and body as ordinary JSON", () => {
    const body = { title: "Invalid input", errors: ["name is required"] };
    const response = Response.json(body, { status: 422, headers: { "X-Request-Id": "trace-1" } });
    const error = FetcherError.make("HTTP failure", {
      kind: "http",
      request,
      response,
      body,
      rawBody: JSON.stringify(body),
    });
    const record = FetcherError.toLogRecord(error);

    assert.partialDeepStrictEqual(record, {
      name: "Error",
      message: "HTTP failure",
      stack: error.stack,
      cause: {
        source: "@zemd/http-client",
        kind: "http",
        request,
        url: request.url,
        method: "POST",
        status: 422,
        headers: { "content-type": "application/json", "x-request-id": "trace-1" },
        contentType: "application/json",
        body,
        rawBody: JSON.stringify(body),
      },
    });
    assert.deepStrictEqual(JSON.parse(JSON.stringify({ err: error })) as unknown, { err: record });
    assert.deepStrictEqual(JSON.parse(JSON.stringify(error.cause)) as unknown, record["cause"]);
    assert.deepStrictEqual(error.cause.toJSON(), record["cause"]);
    assert.strictEqual(Object.hasOwn(error.cause.toJSON(), "response"), false);
    assert.strictEqual(response.bodyUsed, false);
  });

  void it("retains original errors in memory and serializes their nested causes and custom fields", () => {
    const reason = Object.assign(new Error("connection refused"), { code: "ECONNREFUSED" });
    const original = new TypeError("fetch failed", { cause: reason });
    const error = FetcherError.make("Request failed", {
      kind: "request",
      request,
      originalError: original,
    });

    assert.strictEqual(error.cause.originalError, original);
    assert.partialDeepStrictEqual(FetcherError.toLogRecord(error), {
      cause: {
        originalError: {
          name: "TypeError",
          message: "fetch failed",
          stack: original.stack,
          cause: {
            name: "Error",
            message: "connection refused",
            code: "ECONNREFUSED",
            stack: reason.stack,
          },
        },
      },
    });
  });

  void it("serializes body decoding errors without dropping the HTTP status", () => {
    const bodyError = new SyntaxError("invalid JSON");
    const error = FetcherError.make("HTTP failure", {
      kind: "http",
      request,
      response: new Response("{", { status: 502 }),
      rawBody: "{",
      bodyError,
    });
    assert.strictEqual(error.cause.bodyError, bodyError);
    assert.partialDeepStrictEqual(FetcherError.toLogRecord(error), {
      cause: {
        status: 502,
        rawBody: "{",
        bodyError: { name: "SyntaxError", message: "invalid JSON", stack: bodyError.stack },
      },
    });
  });

  void it("serializes AbortError details", () => {
    const original = new DOMException("cancelled by caller", "AbortError");
    const error = FetcherError.make("Request failed", {
      kind: "request",
      request,
      originalError: original,
    });
    assert.partialDeepStrictEqual(FetcherError.toLogRecord(error), {
      cause: { originalError: { name: "AbortError", message: "cancelled by caller" } },
    });
    assert.strictEqual(error.cause.originalError, original);
  });

  void it("serializes non-Error thrown values, bigint, and cycles without throwing", () => {
    const shared = { value: "same object" };
    const original: Record<string, unknown> = { attempt: 3n, first: shared, second: shared };
    original["self"] = original;
    const error = FetcherError.make("Request failed", {
      kind: "request",
      request,
      originalError: original,
    });
    assert.partialDeepStrictEqual(JSON.parse(JSON.stringify(error)) as unknown, {
      cause: { originalError: { attempt: "3", first: shared, second: shared, self: "[Circular]" } },
    });
    assert.strictEqual(error.cause.originalError, original);
  });

  void it("handles circular native causes and aggregate errors", () => {
    const original = new Error("recursive");
    original.cause = original;
    const aggregate = new AggregateError([original, "string rejection"], "all attempts failed");
    const error = FetcherError.make("Request failed", {
      kind: "request",
      request,
      originalError: aggregate,
    });
    assert.partialDeepStrictEqual(FetcherError.toLogRecord(error), {
      cause: {
        originalError: {
          name: "AggregateError",
          message: "all attempts failed",
          errors: [
            { name: "Error", message: "recursive", cause: "[Circular]" },
            "string rejection",
          ],
        },
      },
    });
    assert.doesNotThrow(() => JSON.stringify(error));
  });

  void it("does not let a thrown object's getters or toJSON break logging", () => {
    const original = Object.defineProperty({}, "broken", {
      enumerable: true,
      get() {
        throw new Error("getter failed");
      },
    });
    const error = FetcherError.make("Request failed", {
      kind: "request",
      request,
      originalError: original,
    });
    assert.partialDeepStrictEqual(FetcherError.toLogRecord(error), {
      cause: { originalError: "[Unserializable]" },
    });
    const custom = {
      reason: "failed",
      toJSON() {
        throw new Error("must not call");
      },
    };
    const customError = FetcherError.make("Request failed", {
      kind: "request",
      request,
      originalError: custom,
    });
    assert.partialDeepStrictEqual(JSON.parse(JSON.stringify(customError)) as unknown, {
      cause: { originalError: { reason: "failed" } },
    });
  });
});
