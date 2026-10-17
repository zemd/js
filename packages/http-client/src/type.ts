/**
 * Compatibility aliases for the types defined by the HttpClient module.
 *
 * @module type
 */

import type * as HttpClient from "./HttpClient.ts";

/** @deprecated Use `HttpClient.Type` instead. */
export type Fetch = HttpClient.Type;

/** @deprecated Use `HttpClient.Type` instead. */
export type TFetchFn = HttpClient.Type;

/** @deprecated Use `HttpClient.Params` instead. */
export type FetchParams = HttpClient.Params;

/** @deprecated Use `HttpClient.Params` instead. */
export type TFetchFnParams = HttpClient.Params;

/** @deprecated Use `HttpClient.Transformer` instead. */
export type FetchTransformer = HttpClient.Transformer;

/** @deprecated Use `HttpClient.Transformer` instead. */
export type TFetchTransformer = HttpClient.Transformer;
