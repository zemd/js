import { FuzzedDataProvider } from "@jazzer.js/core";
import { checkGetInvariants, type TObjectsModule } from "@zemd/properties/objects";
import * as objects from "@zemd/std-modules/objects";
import { assertNoViolations, consumeObject, ignoreExpected } from "./helpers";

const contract: TObjectsModule = objects;

/**
 * `get()` only documents a TypeError for non-object roots; everything else it throws is a bug.
 */
const EXPECTED = ["TypeError"];

/**
 * The invariants live in `@zemd/properties` so that the fast-check properties in
 * `packages/std` and this target cannot drift apart; only the input generation differs.
 */
export function fuzz(data: Buffer): void {
  const fdp = new FuzzedDataProvider(data);
  const path = fdp.consumeString(fdp.consumeIntegralInRange(0, 128));
  const object = consumeObject(fdp);

  ignoreExpected(EXPECTED, () => {
    assertNoViolations(checkGetInvariants(contract, object, path));
  });
}
