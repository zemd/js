import assert from "node:assert/strict";
import type { Mock } from "node:test";

type MockableFunction = (...arguments_: never[]) => unknown;

export function mockImplementationSequence<F extends MockableFunction>(
  mockFunction: Mock<F>,
  implementations: readonly F[],
): void {
  const firstCall = mockFunction.mock.callCount();
  implementations.forEach((implementation, index) => {
    mockFunction.mock.mockImplementationOnce(implementation, firstCall + index);
  });
}

export async function getRejection(
  promise: PromiseLike<unknown>,
  message?: string,
): Promise<unknown> {
  let value: unknown;
  try {
    value = await promise;
  } catch (error) {
    return error;
  }
  throw new assert.AssertionError({
    actual: value,
    expected: "a rejected promise",
    message: message ?? "Expected Promise to reject, but it resolved",
    operator: "rejects",
  });
}
