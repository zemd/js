/**
 * URL path and query transformations with raw path segment encoding.
 *
 * @module transformers/UrlTransformer
 */

import type * as HttpClient from "../HttpClient.ts";

const INVALID_PATH_DELIMITER = /[%/\\?#]/;

const hasControlCharacter = (value: string): boolean => {
  for (const character of value) {
    const codePoint = character.codePointAt(0);
    if (
      codePoint !== undefined &&
      (codePoint <= 0x1f || (codePoint >= 0x7f && codePoint <= 0x9f))
    ) {
      return true;
    }
  }
  return false;
};

/**
 * Encodes one raw URL path segment without allowing it to alter route structure.
 * Pre-encoded input is rejected so callers cannot trigger ambiguous double decoding.
 *
 * @param value - The raw, non-empty segment to encode exactly once.
 * @returns The percent-encoded path segment.
 * @throws {TypeError} If the value is empty, a dot segment, or contains a path delimiter,
 *   percent sign, query delimiter, fragment delimiter, backslash, or control character.
 * @throws {URIError} If the value contains an unpaired UTF-16 surrogate.
 */
export const encodePathSegment = (value: string): string => {
  if (
    value.length === 0 ||
    value === "." ||
    value === ".." ||
    INVALID_PATH_DELIMITER.test(value) ||
    hasControlCharacter(value)
  ) {
    throw new TypeError("Invalid URL path segment.", { cause: { received: value } });
  }
  return encodeURIComponent(value);
};

const prependUrlPath = (input: HttpClient.Params[0], prefix: string): HttpClient.Params[0] => {
  if (input instanceof Request) {
    const urlObj = new URL(input.url);
    urlObj.pathname = `${prefix}${urlObj.pathname}`;

    return new Request(urlObj.toString(), input);
  }

  if (input instanceof URL) {
    const urlObj = new URL(input.toString());
    urlObj.pathname = `${prefix}${urlObj.pathname}`;
    return urlObj;
  }

  // typeof input === 'string'
  if (URL.canParse(input)) {
    const urlObj = new URL(input);
    urlObj.pathname = `${prefix}${urlObj.pathname}`;
    return urlObj.toString();
  }

  return `${prefix}${input}`;
};

const appendUrlQuery = (input: HttpClient.Params[0], query: object): HttpClient.Params[0] => {
  if (input instanceof Request) {
    const urlObj = new URL(input.url);
    urlObj.search = `${new URLSearchParams([...Array.from(urlObj.searchParams.entries()), ...Object.entries(query)])}`;
    return new Request(urlObj.toString(), input);
  }

  if (input instanceof URL) {
    const urlObj = new URL(input);
    urlObj.search = `${new URLSearchParams([...Array.from(urlObj.searchParams.entries()), ...Object.entries(query)])}`;
    return urlObj;
  }

  // typeof input === 'string'
  if (URL.canParse(input)) {
    const urlObj = new URL(input);
    urlObj.search = `${new URLSearchParams([...Array.from(urlObj.searchParams.entries()), ...Object.entries(query)])}`;
    return urlObj.toString();
  }

  const [pathname, search] = input.split("?");
  return `${pathname ?? ""}?${new URLSearchParams([...new URLSearchParams(search).entries(), ...Object.entries(query)])}`;
};

/**
 * Creates a transformer that prepends a prefix to the request URL's path.
 * Absolute URLs keep their origin; relative URL strings are prefixed as a whole.
 * The prefix is concatenated directly, without inserting a separator.
 *
 * @param value - The prefix to prepend to the pathname or relative URL string.
 * @returns A transformer that forwards the updated URL and original request options.
 */
export const prependPath = (value: string): HttpClient.Transformer => {
  return async (fetchFn: HttpClient.Type, ...params: HttpClient.Params) => {
    const [urlOrRequest, requestInit] = params;

    return fetchFn(prependUrlPath(urlOrRequest, value), requestInit);
  };
};

/**
 * Creates a transformer that appends query parameters to the request URL.
 * Existing query parameters are retained, including values with the same key.
 *
 * @param parameters - An object whose enumerable string keys and values become query parameters.
 * @returns A transformer that forwards the updated URL and original request options.
 */
export const appendQuery = (parameters: object): HttpClient.Transformer => {
  return async (fetchFn: HttpClient.Type, ...params: HttpClient.Params) => {
    const [urlOrRequest, requestInit] = params;
    return fetchFn(appendUrlQuery(urlOrRequest, parameters), requestInit);
  };
};
