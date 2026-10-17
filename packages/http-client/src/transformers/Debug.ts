/**
 * Request metadata logging with credential redaction.
 *
 * @module transformers/Debug
 */

import type * as HttpClient from "../HttpClient.ts";

const SENSITIVE_FIELD =
  /(?:^|[-_.])(api[-_.]?key|auth(?:orization)?|cookie|credential|jwt|key|password|secret|session|sig(?:nature)?|token)(?:$|[-_.])/i;
const REDACTED = "[REDACTED]";

const redactUrl = (input: string): string => {
  const absolute = URL.canParse(input);
  const url = new URL(input, absolute ? undefined : "https://debug.invalid");
  if (url.username) url.username = REDACTED;
  if (url.password) url.password = REDACTED;
  for (const key of url.searchParams.keys()) {
    if (SENSITIVE_FIELD.test(key)) url.searchParams.set(key, REDACTED);
  }
  if (url.hash.includes("=")) {
    const fragment = new URLSearchParams(url.hash.slice(1));
    for (const key of fragment.keys()) {
      if (SENSITIVE_FIELD.test(key)) fragment.set(key, REDACTED);
    }
    url.hash = fragment.toString();
  }
  return absolute ? url.toString() : `${url.pathname}${url.search}${url.hash}`;
};

const redactHeaders = (headers: HeadersInit | undefined): Readonly<Record<string, string>> => {
  const redacted: Record<string, string> = {};
  for (const [key, value] of new Headers(headers).entries()) {
    redacted[key] = SENSITIVE_FIELD.test(key) ? REDACTED : value;
  }
  return redacted;
};

/** Request metadata passed to a debug logger, with matching credential fields redacted. */
export interface RequestMetadata {
  /** Whether a body is present in the input request or request options. */
  readonly bodyPresent: boolean;
  /** Headers from the request options or input Request, with sensitive values redacted. */
  readonly headers: Readonly<Record<string, string>>;
  /** The method from request options or the input Request, defaulting to `GET`. */
  readonly method: string;
  /** The URL with user information and recognized credential parameters redacted. */
  readonly url: string;
}

/**
 * Receives sanitized request metadata synchronously before the request is forwarded.
 *
 * @param request - The sanitized method, URL, headers, and body-presence flag.
 */
export type Logger = (request: RequestMetadata) => void;

const getRequestMetadata = ([input, init]: HttpClient.Params): RequestMetadata => {
  const request = input instanceof Request ? input : undefined;
  const url = input instanceof Request ? input.url : input instanceof URL ? input.href : input;
  return {
    bodyPresent:
      (init?.body !== undefined && init.body !== null) ||
      (request !== undefined && request.body !== null),
    headers: redactHeaders(init?.headers ?? request?.headers),
    method: init?.method ?? request?.method ?? "GET",
    url: redactUrl(url),
  };
};

const consoleDebug: Logger = (request) => {
  console.debug(JSON.stringify(request, null, 2));
};

/**
 * Creates a transformer that logs sanitized request metadata before forwarding the request.
 * URL user information and recognized credential fields in URLs and headers are redacted.
 * Request bodies are never included in the metadata. Logger failures reject the request promise.
 *
 * @param [logger] - The synchronous metadata logger. Defaults to JSON-formatted console.debug output.
 * @returns A transformer that logs the sanitized metadata and delegates to the next client.
 *
 * @example
 * ```ts
 * import { Debug, HttpClient } from "@zemd/http-client";
 *
 * const client = HttpClient.make([
 *   Debug.make((request) => console.debug(request.method, request.url)),
 * ]);
 * ```
 */
export const make = (logger: Logger = consoleDebug): HttpClient.Transformer => {
  return async (fetchFn: HttpClient.Type, ...params: HttpClient.Params) => {
    logger(getRequestMetadata(params));
    return fetchFn(...params);
  };
};
