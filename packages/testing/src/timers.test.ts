import assert from "node:assert/strict";
import { test } from "node:test";

import { advanceTimersByTime } from "./timers.ts";

void test("advanceTimersByTime yields around a native timer tick", async (context) => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  let completed = false;
  const work = Promise.resolve().then(
    () =>
      new Promise<void>((resolve) => {
        setTimeout(() => {
          completed = true;
          resolve();
        }, 10);
      }),
  );

  await advanceTimersByTime(context.mock.timers, 10);
  await work;
  assert.strictEqual(completed, true);
});

void test("advanceTimersByTime accepts an explicit bound for deeper promise chains", async (context) => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  let preparation: Promise<void> = Promise.resolve();
  for (let index = 0; index < 6; index += 1) {
    preparation = preparation.then(() => undefined);
  }

  let completed = false;
  const work = preparation.then(
    () =>
      new Promise<void>((resolve) => {
        setTimeout(() => {
          completed = true;
          resolve();
        }, 10);
      }),
  );

  await advanceTimersByTime(context.mock.timers, 10, 8);
  await work;
  assert.strictEqual(completed, true);
});

void test("advanceTimersByTime rejects invalid inputs before ticking", async (context) => {
  await assert.rejects(
    () => advanceTimersByTime(context.mock.timers, Number.POSITIVE_INFINITY),
    /non-negative finite number/,
  );
  await assert.rejects(
    () => advanceTimersByTime(context.mock.timers, 0, -1),
    /microtaskTurns must be a non-negative safe integer/,
  );
});
