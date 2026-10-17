/**
 * API client creation with common transformers and configurable response parsing.
 *
 * @module fetcher/Fetcher
 */

import * as HttpClient from "../HttpClient.ts";
import * as FetcherError from "./FetcherError.ts";
import type { RequestMetadata } from "./FetcherError.ts";
import * as ResponseParser from "./ResponseParser.ts";

export { isError, toLogRecord } from "./FetcherError.ts";
export type {
  FetcherError as Error,
  ErrorCause,
  ErrorKind,
  LogRecord,
  LogValue,
  RequestMetadata,
} from "./FetcherError.ts";
export type { ParseMode, Parser, ParseResponse } from "./ResponseParser.ts";

/**
 * Observes a failure, throws a replacement error, or returns a fallback result (sync or async).
 * Returning `undefined` preserves the rejection. The handler runs once per failed API call.
 */
export type ErrorHandler = (error: FetcherError.FetcherError) => unknown;

/** Determines whether a response is accepted for parsing. Defaults to `response.ok`. */
export type ValidateStatus = (status: number, response: Response) => boolean;

/** Client defaults, also accepted as per-request overrides. */
export interface Options {
  /** The body format or custom decoder. Defaults to `"json"`; `false` returns the response. */
  readonly parseResponse?: ResponseParser.ParseResponse;
  /** Customize accepted statuses, e.g. to treat a 404 as a normal response. */
  readonly validateStatus?: ValidateStatus;
  /** Observe, replace, or recover from an error. `null` disables an inherited handler. */
  readonly onError?: ErrorHandler | null;
}

/**
 * An API client with common transformers and response parsing configured.
 * The caller supplies the result type; JSON responses are not validated at runtime.
 *
 * @param url - The URL to request, before applying transformers.
 * @param transformers - Per-request transformers applied after the common transformers.
 * @param options - Per-request parsing, status validation, and error handling overrides.
 * @returns A promise for the parsed result, raw response, or handler fallback.
 *   Unhandled failures reject with native errors carrying a structured `cause`.
 */
export type Type = <Result = Response>(
  url: string,
  transformers?: ReadonlyArray<HttpClient.Transformer>,
  options?: Options,
) => Promise<Result>;

const requestMetadata = ([input, init]: HttpClient.Params): RequestMetadata => ({
  url: input instanceof Request ? input.url : String(input),
  method: init?.method ?? (input instanceof Request ? input.method : "GET"),
});

/**
 * Creates an API client that applies common transformers before per-request transformers.
 * Successful responses are parsed as JSON by default; HEAD, 204, and 205 return the response.
 *
 * @param transformers - The common transformers applied to every request.
 * @param [options] - Defaults for response parsing, accepted statuses, and error handling.
 * @param [client=globalThis.fetch] - The underlying client.
 * @returns An API client that accepts a URL and per-request transformers.
 *
 * @example
 * ```ts
 * import { Fetcher, RequestTransformer, UrlTransformer } from "@zemd/http-client";
 *
 * const fetcher = Fetcher.make([UrlTransformer.prependPath("https://example.com")]);
 * const user = await fetcher<{ name: string }>("/users/1", [
 *   RequestTransformer.setMethod("GET"),
 * ]);
 * ```
 */
export const make = (
  transformers: ReadonlyArray<HttpClient.Transformer>,
  options: Options = {},
  client: HttpClient.Type = globalThis.fetch,
): Type => {
  return async <Result = Response>(
    url: string,
    requestTransformers: ReadonlyArray<HttpClient.Transformer> = [],
    requestOptions: Options = {},
  ): Promise<Result> => {
    const parseResponse = requestOptions.parseResponse ?? options.parseResponse ?? "json";
    const validateStatus = requestOptions.validateStatus ?? options.validateStatus;
    const onError = requestOptions.onError === undefined ? options.onError : requestOptions.onError;
    let request: RequestMetadata = { url, method: "GET" };
    let response: Response | undefined;

    // Track each delegation, including transformers that serve a response without calling fetch.
    const trackRequest =
      (next: HttpClient.Type): HttpClient.Type =>
      (...params) => {
        request = requestMetadata(params);
        return next(...params);
      };

    try {
      const chain = transformers.concat(requestTransformers).map<HttpClient.Transformer>(
        (transformer) =>
          (next, ...params) =>
            transformer(trackRequest(next), ...params),
      );
      response = await HttpClient.make(chain, trackRequest(client))(url);
      if (!(validateStatus ? validateStatus(response.status, response) : response.ok)) {
        const details = await ResponseParser.readErrorBody(response);
        throw FetcherError.make(
          `HTTP error: ${request.method} ${response.url || request.url} (status: ${response.status}${response.statusText ? ` ${response.statusText}` : ""}, Content-Type: ${response.headers.get("Content-Type") ?? "missing"})`,
          { kind: "http", request, response, ...details },
        );
      }
      return (await ResponseParser.parse(response, parseResponse, request)) as Result;
    } catch (err) {
      const error = FetcherError.isError(err)
        ? err
        : FetcherError.make(`Request failed: ${request.method} ${request.url}`, {
            kind: "request",
            request,
            response,
            originalError: err,
          });
      const fallback = await onError?.(error);
      if (fallback !== undefined) {
        return fallback as Result;
      }
      throw error;
    }
  };
};
