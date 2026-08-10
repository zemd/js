import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { advanceTimersByTime, getRejection } from "@zemd/testing";
import { sleep } from "./sleep.ts";

const rejectionError = async (promise: PromiseLike<unknown>): Promise<Error> => {
  const error = await getRejection(promise);
  assert.ok(error instanceof Error);
  if (!(error instanceof Error)) {
    throw new TypeError("expected an Error rejection");
  }
  return error;
};

void describe("sleep function", () => {
  void it("should resolve after the specified timeout", async (context) => {
    context.mock.timers.enable({ apis: ["setTimeout"] });
    const promise = sleep(1000);

    await advanceTimersByTime(context.mock.timers, 1000);

    assert.strictEqual(await promise, undefined);
  });

  void it("should throw an error if timeout is not an integer", async () => {
    await assert.rejects(sleep(Number.NaN), /Timeout must be a valid integer\./);
    await assert.rejects(sleep("1000" as unknown as number), /Timeout must be a valid integer\./);
    await assert.rejects(sleep(1000.5), /Timeout must be a valid integer\./);
  });

  void it("should include the received value in the error cause when timeout is invalid", async () => {
    const error = await rejectionError(sleep("invalid" as unknown as number));
    assert.deepStrictEqual(error.cause, { received: "invalid" });
  });

  void it("should throw if AbortSignal is already aborted before starting", async () => {
    const controller = new AbortController();
    controller.abort("test reason");

    await assert.rejects(
      sleep(1000, controller.signal),
      /The sleep method was aborted before start\./,
    );
  });

  void it("should include the abort reason in the error cause when aborted before start", async () => {
    const controller = new AbortController();
    controller.abort("test reason");

    const error = await rejectionError(sleep(1000, controller.signal));
    assert.deepStrictEqual(error.cause, { cause: { reason: "test reason" } });
  });

  void it("should throw if AbortSignal is aborted during sleep", async (context) => {
    context.mock.timers.enable({ apis: ["setTimeout"] });
    const controller = new AbortController();
    const promise = sleep(2000, controller.signal);

    await advanceTimersByTime(context.mock.timers, 500);
    controller.abort("aborted during sleep");

    await assert.rejects(promise, /The sleep method aborted\./);
  });

  void it("should include the abort reason in the error cause when aborted during sleep", async (context) => {
    context.mock.timers.enable({ apis: ["setTimeout"] });
    const controller = new AbortController();
    const promise = sleep(2000, controller.signal);

    await advanceTimersByTime(context.mock.timers, 500);
    controller.abort("aborted during sleep");

    const error = await rejectionError(promise);
    assert.deepStrictEqual(error.cause, {
      cause: { reason: "aborted during sleep" },
    });
  });

  void it("should handle Error objects as abort reasons", async (context) => {
    context.mock.timers.enable({ apis: ["setTimeout"] });
    const controller = new AbortController();
    const customError = new Error("Custom error");
    const promise = sleep(2000, controller.signal);

    await advanceTimersByTime(context.mock.timers, 500);
    controller.abort(customError);

    const error = await rejectionError(promise);
    assert.deepStrictEqual(error.cause, { cause: customError });
  });

  void it("should clean up timers when aborted", async (context) => {
    context.mock.timers.enable({ apis: ["setTimeout"] });
    const clearTimeoutSpy = context.mock.method(globalThis, "clearTimeout");
    const controller = new AbortController();
    const promise = sleep(2000, controller.signal);

    await advanceTimersByTime(context.mock.timers, 500);
    controller.abort();

    await getRejection(promise);
    assert.ok(clearTimeoutSpy.mock.callCount() > 0);
  });
});
