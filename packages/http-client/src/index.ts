/**
 * Public namespace exports and compatibility aliases for the HTTP client package.
 *
 * @module index
 */

export * as HttpClient from "./HttpClient.ts";
export * as Fetcher from "./fetcher/Fetcher.ts";
export * as FetchMock from "./mock/FetchMock.ts";
export { RequestTransformer, UrlTransformer, Retry, Cache, Debug } from "./transformers.ts";

// Deprecated flat API aliases retained for compatibility. Use the namespaces above.
export type {
  Fetch,
  FetchParams,
  FetchTransformer,
  TFetchFn,
  TFetchFnParams,
  TFetchTransformer,
} from "./type.ts";
export { compose } from "./compose.ts";
export { createEndpoint } from "./endpoint.ts";
export {
  method,
  header,
  json,
  body,
  prefix,
  query,
  pathSegment,
  retry,
  cache,
  debug,
  type TShouldRetry,
  type DebugRequest,
  type DebugLogger,
} from "./transformers.ts";
export {
  fetchMock,
  addEndpointMock,
  clearEndpointMocks,
  type TMockPathname,
  type TMockMethod,
  type TMockImplementation,
} from "./fetchMock.ts";
