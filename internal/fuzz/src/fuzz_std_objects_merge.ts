import { FuzzedDataProvider } from "@jazzer.js/core";
import { checkMergeInvariants, type TObjectsModule } from "@zemd/properties/objects";
import * as objects from "@zemd/std-modules/objects";
import { assertNoViolations, consumeObject, ignoreExpected } from "./helpers";

const contract: TObjectsModule = objects;

/**
 * `merge()` clones values with `structuredClone`, which rejects non-cloneable values
 * (DataCloneError). Any other failure is a bug.
 */
const EXPECTED = ["DataCloneError"];

/**
 * The invariants live in `@zemd/properties` so that the fast-check properties in
 * `packages/std` and this target cannot drift apart; only the input generation differs.
 */
export function fuzz(data: Buffer): void {
  const fdp = new FuzzedDataProvider(data);
  const inputs: (Record<string, unknown> | null | undefined)[] = [];
  const count = fdp.consumeIntegralInRange(0, 4);

  for (let i = 0; i < count; i += 1) {
    switch (fdp.consumeIntegralInRange(0, 5)) {
      case 0: {
        inputs.push(null);
        break;
      }
      case 1: {
        inputs.push(undefined);
        break;
      }
      default: {
        inputs.push(consumeObject(fdp));
      }
    }
  }

  ignoreExpected(EXPECTED, () => {
    assertNoViolations(checkMergeInvariants(contract, inputs));
  });
}
