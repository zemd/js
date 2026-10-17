/**
 * Fetch-compatible client types and ordered transformer composition.
 *
 * @module HttpClient
 */

/** A function compatible with the native Fetch API. */
export type Type = typeof globalThis.fetch;

/** The input and optional request options accepted by an HTTP client. */
export type Params = Parameters<Type>;

/**
 * A request or response transformation that delegates to the next HTTP client.
 *
 * @param client - The next client in the transformer chain.
 * @param params - The request input and optional request options.
 * @returns A promise for the response produced by the transformer chain.
 */
export type Transformer = (client: Type, ...params: Params) => ReturnType<Type>;

/**
 * Creates a fetch-compatible client that applies transformers in the listed order.
 *
 * @param transformers - The transformers to apply in order.
 * @param [client=globalThis.fetch] - The underlying client.
 * @returns The composed client, or the underlying client if the list is empty.
 *
 * @example
 * ```ts
 * import { HttpClient, RequestTransformer } from "@zemd/http-client";
 *
 * const post = HttpClient.make([
 *   RequestTransformer.setMethod("POST"),
 *   RequestTransformer.jsonContentType(),
 * ]);
 * ```
 */
export const make = (
  transformers: ReadonlyArray<Transformer>,
  client: Type = globalThis.fetch,
): Type => {
  return transformers.reduceRight<Type>((nextClient, transformer) => {
    return async (...params) => {
      return transformer(nextClient, ...params);
    };
  }, client);
};
