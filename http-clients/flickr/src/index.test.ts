import assert from "node:assert/strict";
import { test } from "node:test";

import { flickr } from "./index.ts";

void test("debug logging never includes the Flickr API key", async (context) => {
  const debug = context.mock.method(console, "debug", () => undefined);
  const fetchMock = context.mock.method(globalThis, "fetch", async () => Response.json({}));

  await flickr("FLICKR_AUDIT_CANARY", { debug: true }).activity.userComments({});

  assert.strictEqual(debug.mock.callCount(), 1);
  assert.doesNotMatch(JSON.stringify(debug.mock.calls), /FLICKR_AUDIT_CANARY/);
  assert.match(JSON.stringify(debug.mock.calls), /api_key=.*REDACTED/);
  const [input] = fetchMock.mock.calls[0]?.arguments ?? [];
  const url = input instanceof Request ? input.url : input instanceof URL ? input.href : input;
  assert.match(url ?? "", /api_key=FLICKR_AUDIT_CANARY/);
});
