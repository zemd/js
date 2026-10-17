/**
 * Request and response transformer namespaces with compatibility aliases.
 *
 * @module transformers
 */

import * as RequestTransformer from "./transformers/RequestTransformer.ts";
import * as UrlTransformer from "./transformers/UrlTransformer.ts";
import * as Retry from "./transformers/Retry.ts";
import * as Cache from "./transformers/Cache.ts";
import * as Debug from "./transformers/Debug.ts";

export { RequestTransformer, UrlTransformer, Retry, Cache, Debug };

/** @deprecated Use `RequestTransformer.setMethod` instead. */
export const method: typeof RequestTransformer.setMethod = RequestTransformer.setMethod;

/** @deprecated Use `RequestTransformer.appendHeader` instead. */
export const header: typeof RequestTransformer.appendHeader = RequestTransformer.appendHeader;

/** @deprecated Use `RequestTransformer.jsonContentType` instead. */
export const json: typeof RequestTransformer.jsonContentType = RequestTransformer.jsonContentType;

/** @deprecated Use `RequestTransformer.setBody` instead. */
export const body: typeof RequestTransformer.setBody = RequestTransformer.setBody;

/** @deprecated Use `UrlTransformer.prependPath` instead. */
export const prefix: typeof UrlTransformer.prependPath = UrlTransformer.prependPath;

/** @deprecated Use `UrlTransformer.appendQuery` instead. */
export const query: typeof UrlTransformer.appendQuery = UrlTransformer.appendQuery;

/** @deprecated Use `UrlTransformer.encodePathSegment` instead. */
export const pathSegment: typeof UrlTransformer.encodePathSegment =
  UrlTransformer.encodePathSegment;

/** @deprecated Use `Retry.make` instead. */
export const retry: typeof Retry.make = Retry.make;

/** @deprecated Use `Retry.ShouldRetry` instead. */
export type TShouldRetry = Retry.ShouldRetry;

/** @deprecated Use `Cache.make` instead. */
export const cache: typeof Cache.make = Cache.make;

/** @deprecated Use `Debug.make` instead. */
export const debug: typeof Debug.make = Debug.make;

/** @deprecated Use `Debug.RequestMetadata` instead. */
export type DebugRequest = Debug.RequestMetadata;

/** @deprecated Use `Debug.Logger` instead. */
export type DebugLogger = Debug.Logger;
