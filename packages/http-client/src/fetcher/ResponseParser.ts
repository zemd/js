/**
 * Response body parsing and diagnostic body reading for API clients.
 *
 * @module fetcher/ResponseParser
 */

import * as FetcherError from "./FetcherError.ts";
import type { RequestMetadata } from "./FetcherError.ts";

/** `auto` selects JSON for JSON media types and text otherwise; `false` preserves the response. */
export type ParseMode = "json" | "text" | "auto" | false;

/** A custom response decoder. May return a value or a promise. */
export type Parser = (response: Response) => unknown;

/** A built-in parsing mode or a custom decoder. */
export type ParseResponse = ParseMode | Parser;

const isJson = (response: Response): boolean => {
  const mediaType = response.headers.get("Content-Type")?.split(";", 1)[0]?.trim();
  return mediaType !== undefined && /^application\/(?:json|[^\s/;]+\+json)$/i.test(mediaType);
};

/** Diagnostic details from an HTTP error body. */
export interface ErrorBody {
  readonly body?: unknown;
  readonly rawBody?: string;
  readonly bodyError?: unknown;
}

/** Reads a clone so HTTP error handlers can still consume the original response. */
export const readErrorBody = async (response: Response): Promise<ErrorBody> => {
  let rawBody: string;
  try {
    rawBody = await response.clone().text();
  } catch (bodyError) {
    return { bodyError };
  }

  if (isJson(response) && rawBody !== "") {
    try {
      return { body: JSON.parse(rawBody) as unknown, rawBody };
    } catch (bodyError) {
      return { body: rawBody, rawBody, bodyError };
    }
  }
  return { body: rawBody, rawBody };
};

/**
 * Reads an accepted response using the requested mode.
 * HEAD, 204, and 205 responses are returned unchanged because they have no body to parse.
 *
 * @param response - The HTTP response to check and parse.
 * @param mode - The body format, custom decoder, or `false` to preserve the response.
 * @param request - The last request metadata forwarded through the transformer chain.
 * @returns A promise for the parsed body or original response.
 * @throws {Error} If reading or decoding fails, with diagnostics and the original error in `cause`.
 */
export const parse = async (
  response: Response,
  mode: ParseResponse,
  request: RequestMetadata,
): Promise<unknown> => {
  if (
    response.status === 204 ||
    response.status === 205 ||
    request.method.toUpperCase() === "HEAD" ||
    mode === false
  ) {
    return response;
  }

  const format = mode === "auto" ? (isJson(response) ? "json" : "text") : mode;
  let rawBody: string | undefined;
  try {
    if (typeof format === "function") {
      return await format(response);
    }
    rawBody = await response.text();
    return format === "json" ? (JSON.parse(rawBody) as unknown) : rawBody;
  } catch (originalError) {
    const expected = typeof format === "function" ? "custom parser" : format;
    const contentType = response.headers.get("Content-Type") ?? "missing";
    throw FetcherError.make(
      `Failed to parse response as ${expected}: ${request.method} ${response.url || request.url} (status: ${response.status}, Content-Type: ${contentType})`,
      { kind: "parse", request, response, originalError, body: rawBody, rawBody },
    );
  }
};
