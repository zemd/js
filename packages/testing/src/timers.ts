import type { MockTimers } from "node:test";

const defaultMicrotaskTurns = 1;

export async function advanceTimersByTime(
  timers: MockTimers,
  milliseconds: number,
  microtaskTurns: number = defaultMicrotaskTurns,
): Promise<void> {
  if (!Number.isFinite(milliseconds) || milliseconds < 0) {
    throw new TypeError("milliseconds must be a non-negative finite number");
  }
  if (!Number.isSafeInteger(microtaskTurns) || microtaskTurns < 0) {
    throw new TypeError("microtaskTurns must be a non-negative safe integer");
  }

  for (let index = 0; index < microtaskTurns; index += 1) {
    await Promise.resolve();
  }
  timers.tick(milliseconds);
  for (let index = 0; index < microtaskTurns; index += 1) {
    await Promise.resolve();
  }
}
