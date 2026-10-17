/**
 * Unit tests for response decoding and diagnostic body reads.
 *
 * @module fetcher/ResponseParser.test
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getRejection } from "@zemd/testing";
import * as FetcherError from "./FetcherError.ts";
import * as ResponseParser from "./ResponseParser.ts";

const request = { url: "https://example.com/users", method: "GET" };

void describe("ResponseParser.parse", () => {
  for (const contentType of [
    "application/json",
    "Application/Problem+JSON; charset=utf-8",
    "application/vnd.api+json",
  ]) {
    void it(`automatically decodes ${contentType}`, async () => {
      const response = new Response('{"ok":true}', { headers: { "Content-Type": contentType } });
      assert.deepStrictEqual(await ResponseParser.parse(response, "auto", request), { ok: true });
    });
  }

  for (const contentType of ["text/plain", "text/html", null]) {
    void it(`automatically returns text for ${contentType ?? "missing content type"}`, async () => {
      const response = new Response("server message");
      if (contentType === null) response.headers.delete("Content-Type");
      else response.headers.set("Content-Type", contentType);
      assert.strictEqual(await ResponseParser.parse(response, "auto", request), "server message");
    });
  }

  void it("keeps malformed advertised JSON as a native error with structured context", async () => {
    const response = new Response("invalid", { headers: { "Content-Type": "application/json" } });
    const error = await getRejection(ResponseParser.parse(response, "auto", request));

    assert.ok(FetcherError.isError(error));
    assert.strictEqual(Object.getPrototypeOf(error), Error.prototype);
    assert.strictEqual(error.cause.kind, "parse");
    assert.strictEqual(error.cause.response, response);
    assert.strictEqual(error.cause.rawBody, "invalid");
    assert.ok(error.cause.originalError instanceof SyntaxError);
  });

  void it("parses valid JSON with a wrong content type in explicit JSON mode", async () => {
    const response = new Response('{"ok":true}', { headers: { "Content-Type": "text/plain" } });
    assert.deepStrictEqual(await ResponseParser.parse(response, "json", request), { ok: true });
  });

  void it("returns text when explicitly requested even for a JSON content type", async () => {
    assert.strictEqual(
      await ResponseParser.parse(Response.json({ ok: true }), "text", request),
      '{"ok":true}',
    );
  });

  void it("returns an unread response when parsing is disabled", async () => {
    const response = Response.json({ ok: true });
    assert.strictEqual(await ResponseParser.parse(response, false, request), response);
    assert.strictEqual(response.bodyUsed, false);
  });

  void it("reports an empty JSON body with its text and response metadata", async () => {
    const response = new Response("");
    const error = await getRejection(ResponseParser.parse(response, "json", request));
    assert.ok(FetcherError.isError(error));
    assert.strictEqual(error.cause.rawBody, "");
    assert.strictEqual(error.cause.status, 200);
  });

  void it("awaits a custom decoder", async () => {
    const result = await ResponseParser.parse(
      new Response("file contents"),
      async (response) => ({ text: await response.text() }),
      request,
    );
    assert.deepStrictEqual(result, { text: "file contents" });
  });

  void it("retains the original custom parser failure inside the cause", async () => {
    const failure = new Error("schema validation failed");
    const error = await getRejection(
      ResponseParser.parse(
        Response.json({}),
        async () => {
          throw failure;
        },
        request,
      ),
    );
    assert.ok(FetcherError.isError(error));
    assert.strictEqual(error.cause.kind, "parse");
    assert.strictEqual(error.cause.originalError, failure);
    assert.match(error.message, /custom parser/);
  });

  for (const [method, status] of [
    ["HEAD", 200],
    ["GET", 204],
    ["GET", 205],
  ] as const) {
    void it(`returns a bodyless ${method} ${status} response without running a parser`, async () => {
      const response = new Response(null, { status });
      const result = await ResponseParser.parse(
        response,
        () => {
          throw new Error("must not parse");
        },
        { ...request, method },
      );
      assert.strictEqual(result, response);
    });
  }

  for (const mode of ["json", "text"] as const) {
    void it(`retains ${mode} body read failures with the original error`, async () => {
      const failure = new Error("stream disconnected");
      const response = new Response(
        new ReadableStream({
          start(controller) {
            controller.error(failure);
          },
        }),
      );
      const error = await getRejection(ResponseParser.parse(response, mode, request));
      assert.ok(FetcherError.isError(error));
      assert.strictEqual(error.cause.kind, "parse");
      assert.strictEqual(error.cause.originalError, failure);
      assert.strictEqual(error.cause.rawBody, undefined);
    });
  }
});

void describe("ResponseParser.readErrorBody", () => {
  void it("decodes problem details while leaving the original response unread", async () => {
    const body = { title: "Invalid input" };
    const response = new Response(JSON.stringify(body), {
      status: 422,
      headers: { "Content-Type": "application/problem+json" },
    });
    assert.deepStrictEqual(await ResponseParser.readErrorBody(response), {
      body,
      rawBody: JSON.stringify(body),
    });
    assert.strictEqual(response.bodyUsed, false);
    assert.deepStrictEqual(await response.json(), body);
  });

  void it("retains text for non-JSON error responses", async () => {
    const response = new Response("<html>Bad gateway</html>", {
      status: 502,
      headers: { "Content-Type": "text/html" },
    });
    assert.deepStrictEqual(await ResponseParser.readErrorBody(response), {
      body: "<html>Bad gateway</html>",
      rawBody: "<html>Bad gateway</html>",
    });
  });

  void it("retains malformed JSON and the decoding failure", async () => {
    const result = await ResponseParser.readErrorBody(
      new Response("{invalid", { status: 500, headers: { "Content-Type": "application/json" } }),
    );
    assert.strictEqual(result.body, "{invalid");
    assert.strictEqual(result.rawBody, "{invalid");
    assert.ok(result.bodyError instanceof SyntaxError);
  });

  void it("reports a read failure without throwing or hiding the HTTP status", async () => {
    const failure = new Error("connection lost");
    const response = new Response(
      new ReadableStream({
        start(controller) {
          controller.error(failure);
        },
      }),
      { status: 503 },
    );
    assert.deepStrictEqual(await ResponseParser.readErrorBody(response), { bodyError: failure });
    assert.strictEqual(response.status, 503);
  });
});
