/**
 * Tests for public aliases retained during migration to the namespace API.
 *
 * @module compatibility.test
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as api from "./index.ts";
import { compose } from "./compose.ts";
import { createEndpoint } from "./endpoint.ts";
import { addEndpointMock, clearEndpointMocks, fetchMock } from "./fetchMock.ts";
import * as transformers from "./transformers.ts";

void describe("compatibility exports", () => {
  void it("preserves client, endpoint, and mock aliases at the original entry points", () => {
    assert.strictEqual(compose, api.HttpClient.make);
    assert.strictEqual(api.compose, api.HttpClient.make);
    assert.strictEqual(createEndpoint, api.Fetcher.make);
    assert.strictEqual(api.createEndpoint, api.Fetcher.make);
    assert.strictEqual(fetchMock, api.FetchMock.fetch);
    assert.strictEqual(api.fetchMock, api.FetchMock.fetch);
    assert.strictEqual(addEndpointMock, api.FetchMock.register);
    assert.strictEqual(api.addEndpointMock, api.FetchMock.register);
    assert.strictEqual(clearEndpointMocks, api.FetchMock.clear);
    assert.strictEqual(api.clearEndpointMocks, api.FetchMock.clear);
  });

  for (const [name, replacement] of [
    ["method", api.RequestTransformer.setMethod],
    ["header", api.RequestTransformer.appendHeader],
    ["json", api.RequestTransformer.jsonContentType],
    ["body", api.RequestTransformer.setBody],
    ["prefix", api.UrlTransformer.prependPath],
    ["query", api.UrlTransformer.appendQuery],
    ["pathSegment", api.UrlTransformer.encodePathSegment],
    ["retry", api.Retry.make],
    ["cache", api.Cache.make],
    ["debug", api.Debug.make],
  ] as const) {
    void it(`keeps ${name} as an alias of its namespace operation`, () => {
      assert.strictEqual(api[name], replacement);
      assert.strictEqual(transformers[name], replacement);
    });
  }
});
