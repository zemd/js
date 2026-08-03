import { FuzzedDataProvider } from "@jazzer.js/core";
import { builder, buildPathsObject, buildServerObject } from "@zemd/openapi";
import { assertPrototypesIntact, consumeKey, consumeObject, ignoreExpected } from "./helpers";

/**
 * The builders clone their inputs with `structuredClone`, which rejects non-cloneable
 * values with a DataCloneError. Everything else is unexpected.
 */
const EXPECTED = ["DataCloneError", "TypeError"];

const consumeTemplateUrl = (fdp: FuzzedDataProvider): string => {
  const parts: string[] = [];
  const segments = fdp.consumeIntegralInRange(0, 6);
  for (let i = 0; i < segments; i += 1) {
    parts.push(
      fdp.consumeBoolean()
        ? `{${consumeKey(fdp)}}`
        : fdp.consumeString(fdp.consumeIntegralInRange(0, 16)),
    );
  }
  return `/${parts.join("/")}`;
};

export function fuzz(data: Buffer): void {
  const fdp = new FuzzedDataProvider(data);
  const url = consumeTemplateUrl(fdp);
  const variables = consumeObject(fdp);

  ignoreExpected(EXPECTED, () => {
    const server = buildServerObject(url, variables as never);
    JSON.stringify(server);
  });

  ignoreExpected(EXPECTED, () => {
    const paths = buildPathsObject(
      url as `/${string}`,
      {
        parameters: variables,
        summary: fdp.consumeString(fdp.consumeIntegralInRange(0, 32)),
      } as never,
    );
    JSON.stringify(paths);
  });

  ignoreExpected(EXPECTED, () => {
    const built = builder(consumeObject(fdp) as never).toJSON();
    JSON.stringify(built);
  });

  assertPrototypesIntact("openapi builders");
}
