import { FuzzedDataProvider } from "@jazzer.js/core";
import { checkUrlInvariants, type THttpClientModule } from "@zemd/properties/http-client";
import * as client from "@zemd/http-client";
import { assertNoViolations, consumeObject } from "./helpers";

const contract: THttpClientModule = client;

const URL_TEMPLATES = [
  "https://example.com/a/b?x=1",
  "http://user:pass@example.com:8080/p/q",
  "https://example.com",
  "/relative/path?q=2",
  "//example.com/protocol-relative",
  "?only=query",
  "",
] as const;

const consumeUrl = (fdp: FuzzedDataProvider): string => {
  if (fdp.consumeBoolean()) {
    return URL_TEMPLATES[fdp.consumeIntegralInRange(0, URL_TEMPLATES.length - 1)] as string;
  }
  return fdp.consumeString(fdp.consumeIntegralInRange(0, 128));
};

/**
 * The invariants live in `@zemd/properties` so that the fast-check properties in
 * `packages/http-client` and this target cannot drift apart; only the input generation
 * differs.
 */
export async function fuzz(data: Buffer): Promise<void> {
  const fdp = new FuzzedDataProvider(data);
  const url = consumeUrl(fdp);
  const pathPrefix = fdp.consumeString(fdp.consumeIntegralInRange(0, 64));
  const queryParams = consumeObject(fdp);

  assertNoViolations(await checkUrlInvariants(contract, url, pathPrefix, queryParams));
}
