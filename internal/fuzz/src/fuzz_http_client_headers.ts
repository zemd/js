import { FuzzedDataProvider } from "@jazzer.js/core";
import { checkHeaderInvariants, type THttpClientModule } from "@zemd/properties/http-client";
import * as client from "@zemd/http-client";
import { assertNoViolations } from "./helpers";

const contract: THttpClientModule = client;

const HEADER_NAMES = [
  "Authorization",
  "Content-Type",
  "Cookie",
  "Host",
  "X-Forwarded-For",
  "X-Request-Id",
] as const;

const METHOD_NAMES = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"] as const;

/**
 * Most random byte strings are rejected by `Headers` as invalid names, so half of the
 * inputs start from a realistic name to keep the sink reachable.
 */
const consumeHeaderName = (fdp: FuzzedDataProvider): string => {
  const name = fdp.consumeBoolean()
    ? (HEADER_NAMES[fdp.consumeIntegralInRange(0, HEADER_NAMES.length - 1)] as string)
    : "";
  return `${name}${fdp.consumeString(fdp.consumeIntegralInRange(0, 48))}`;
};

const consumeMethodName = (fdp: FuzzedDataProvider): string => {
  if (fdp.consumeBoolean()) {
    return METHOD_NAMES[fdp.consumeIntegralInRange(0, METHOD_NAMES.length - 1)] as string;
  }
  return fdp.consumeString(fdp.consumeIntegralInRange(0, 32));
};

/**
 * The invariants live in `@zemd/properties` so that the fast-check properties in
 * `packages/http-client` and this target cannot drift apart; only the input generation
 * differs.
 */
export async function fuzz(data: Buffer): Promise<void> {
  const fdp = new FuzzedDataProvider(data);
  const headerName = consumeHeaderName(fdp);
  const methodName = consumeMethodName(fdp);
  const headerValue = fdp.consumeRemainingAsString();

  assertNoViolations(await checkHeaderInvariants(contract, methodName, headerName, headerValue));
}
