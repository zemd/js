/**
 * Request retries with configurable eligibility, delay, and backoff.
 *
 * @module transformers/Retry
 */

import type * as HttpClient from "../HttpClient.ts";

/**
 * Decides whether to retry a failed request while retries remain.
 *
 * @param error - The thrown error or non-successful HTTP response.
 * @param attempt - The one-based number of the attempt that just failed.
 * @returns Whether another request attempt should be made.
 */
export type ShouldRetry = (error: unknown, attempt: number) => boolean;

const shouldRetryByDefault: ShouldRetry = (error) => {
  if (error instanceof Response) {
    return error.status >= 500 && error.status <= 599;
  }

  if (error instanceof Error && error.name === "AbortError") {
    return false;
  }

  return (
    error instanceof TypeError ||
    (typeof DOMException !== "undefined" &&
      error instanceof DOMException &&
      error.name === "NetworkError")
  );
};

const wait = async (delay: number): Promise<void> => {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, delay);
  });
};

const cancelResponseBody = async (response: Response): Promise<void> => {
  try {
    await response.body?.cancel();
  } catch {
    // Failure to release a discarded response body must not replace the request result.
  }
};

/**
 * Creates a transformer that retries eligible request failures.
 * The default predicate retries TypeError and NetworkError failures and HTTP 5xx responses,
 * excluding AbortError failures. Discarded response bodies are cancelled before retrying.
 *
 * @param [maxRetries=3] - The maximum number of retries after the initial attempt.
 * @param [delay=1000] - The base delay between attempts, in milliseconds.
 * @param [backoffFactor=1] - A fixed delay multiplier, or a function of the zero-based retry index.
 * @param [shouldRetry] - A predicate receiving the failure and one-based attempt number.
 *   Defaults to the network-error and HTTP 5xx policy described above.
 * @returns A transformer that returns the final response or rejects with the final thrown error.
 *
 * @example
 * ```ts
 * import { HttpClient, Retry } from "@zemd/http-client";
 *
 * const client = HttpClient.make([Retry.make(3, 100, (retryIndex) => 2 ** retryIndex)]);
 * ```
 */
export const make = (
  maxRetries: number = 3,
  delay: number = 1000,
  backoffFactor: number | ((attempt: number) => number) = 1,
  shouldRetry: ShouldRetry = shouldRetryByDefault,
): HttpClient.Transformer => {
  return async (fetchFn: HttpClient.Type, ...params: HttpClient.Params) => {
    let retries = 0;

    while (true) {
      let response: Response;
      try {
        response = await fetchFn(...params);
      } catch (error) {
        if (retries >= maxRetries || !shouldRetry(error, retries + 1)) {
          throw error;
        }

        const backoffDelay =
          delay * (typeof backoffFactor === "number" ? backoffFactor : backoffFactor(retries));
        await wait(backoffDelay);
        retries += 1;
        continue;
      }

      if (response.ok || retries >= maxRetries || !shouldRetry(response, retries + 1)) {
        return response;
      }

      await cancelResponseBody(response);
      const backoffDelay =
        delay * (typeof backoffFactor === "number" ? backoffFactor : backoffFactor(retries));
      await wait(backoffDelay);
      retries += 1;
    }
  };
};
