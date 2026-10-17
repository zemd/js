/**
 * Immutable transformations of request methods, headers, and bodies.
 *
 * @module transformers/RequestTransformer
 */

import type * as HttpClient from "../HttpClient.ts";

/**
 * RFC 9110 token: the only characters allowed in an HTTP method name.
 */
const HTTP_TOKEN = /^[!#$%&'*+\-.^_`|~\dA-Za-z]+$/;

/**
 * Creates a transformer that sets the HTTP method without mutating request options.
 *
 * @param name - A valid RFC 9110 method token, such as `GET`, `POST`, or `QUERY`.
 * @returns A transformer that forwards the method exactly as supplied.
 * @throws {TypeError} If the method name is not a valid RFC 9110 token.
 */
export const setMethod = (name: string): HttpClient.Transformer => {
  if (!HTTP_TOKEN.test(name)) {
    throw new TypeError("Invalid HTTP method name.", { cause: { received: name } });
  }

  return async (fetchFn: HttpClient.Type, ...params: HttpClient.Params): Promise<Response> => {
    const [input, init] = params;
    return fetchFn(input, { ...init, method: name });
  };
};

/**
 * Creates a transformer that appends a header to the supplied request options.
 * Existing values are retained, and the caller's options and headers are not mutated.
 * Invalid header names or values cause the returned transformer's promise to reject.
 *
 * @param key - The header name to append.
 * @param value - The header value to append.
 * @returns A transformer that forwards a new request options object with the appended header.
 */
export const appendHeader = (key: string, value: string): HttpClient.Transformer => {
  return async (fetchFn: HttpClient.Type, ...params: HttpClient.Params) => {
    const [urlOrRequest, requestInit] = params;

    const headers = new Headers(requestInit?.headers);
    headers.append(key, value);

    return fetchFn(urlOrRequest, {
      ...requestInit,
      headers: Object.fromEntries(headers.entries()),
    });
  };
};

/**
 * Creates a transformer that appends `application/json` to the Content-Type header.
 * Existing Content-Type values are retained, following the behavior of `appendHeader`.
 *
 * @returns A transformer that appends the JSON content type without serializing the body.
 */
export const jsonContentType = (): HttpClient.Transformer => {
  return appendHeader("Content-Type", "application/json");
};

/**
 * Creates a transformer that replaces the request body without mutating request options.
 *
 * @param value - The body to send, already serialized when necessary.
 * @returns A transformer that forwards the supplied body with the other request options.
 */
export const setBody = (value: BodyInit): HttpClient.Transformer => {
  return async (fetchFn: HttpClient.Type, ...params: HttpClient.Params) => {
    const [urlOrRequest, requestInit] = params;
    return fetchFn(urlOrRequest, { ...requestInit, body: value });
  };
};
