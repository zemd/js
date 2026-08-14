import assert from "node:assert/strict";
import { describe, it, type TestContext } from "node:test";
import { compose } from "@zemd/http-client";

import { figma } from "./api.ts";
import { figmaToken } from "./utils.ts";

const fetchMock = (context: TestContext) =>
  context.mock.method(globalThis, "fetch", async () => Response.json({}));

void describe("Figma client request boundaries", () => {
  void it("encodes a valid file key and attaches the token only to the Figma origin", async (context) => {
    const mockFetch = fetchMock(context);
    await figma([figmaToken("FIGMA_CANARY")]).v1.files.getFile("file key:1");

    const [input, init] = mockFetch.mock.calls[0]?.arguments ?? [];
    assert.strictEqual(input, "https://api.figma.com/v1/files/file%20key%3A1");
    assert.deepStrictEqual(init?.headers, {
      "content-type": "application/json",
      "x-figma-token": "FIGMA_CANARY",
    });
  });

  void it("rejects hostile path identifiers before fetch", async (context) => {
    const mockFetch = fetchMock(context);
    const client = figma([figmaToken("FIGMA_CANARY")]);
    for (const fileKey of ["..", "../../me", "%2e%2e/me", "key?x=1", "key#fragment"]) {
      await assert.rejects(client.v1.files.getFile(fileKey), /Invalid URL path segment/);
    }
    assert.strictEqual(mockFetch.mock.callCount(), 0);
  });

  void it("refuses to forward a Figma token to another origin", async (context) => {
    const mockFetch = fetchMock(context);
    await assert.rejects(
      compose([figmaToken("FIGMA_CANARY")], mockFetch)("https://attacker.example/resource"),
      /Refusing to send a Figma token/,
    );
    assert.strictEqual(mockFetch.mock.callCount(), 0);
  });
});
