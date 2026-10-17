/**
 * Fetch-compatible responses backed by a shared mock endpoint registry.
 *
 * @module mock/FetchMock
 */

import type * as HttpClient from "../HttpClient.ts";
import type * as Pathname from "./Pathname.ts";
import * as Registry from "./Registry.ts";

export type { Type as Pathname } from "./Pathname.ts";
export type { Implementation, Method } from "./Registry.ts";

const registry = Registry.make();

const getUrl = (input: HttpClient.Params[0]): URL => {
  if (input instanceof URL) {
    return input;
  }
  return new URL(typeof input === "string" ? input : input.url);
};

/**
 * Fetches a response from the shared mock registry.
 * Returned Response objects are preserved; other results are encoded as JSON.
 * Failures in mock implementations or JSON serialization produce a 500 response.
 *
 * @param input - An absolute URL string, URL object, or Request.
 * @param [options] - Request options passed to the mock implementation.
 * @returns A promise for the mock response or a 500 response on implementation failure.
 * @throws {TypeError} The returned promise rejects if the input URL cannot be parsed.
 * @throws {Error} The returned promise rejects if no registration matches the request.
 *
 * @example
 * ```ts
 * import { FetchMock, HttpClient, UrlTransformer } from "@zemd/http-client";
 *
 * FetchMock.register("/users", "GET", () => [{ name: "Ada" }]);
 * const client = HttpClient.make([
 *   UrlTransformer.prependPath("https://example.com"),
 * ], FetchMock.fetch);
 * ```
 */
export const fetch: HttpClient.Type = async (input, options) => {
  const method = (
    options?.method ?? (input instanceof Request ? input.method : "GET")
  ).toUpperCase();
  const url = getUrl(input);
  const implementation = Registry.find(
    registry,
    [`${url.origin}${url.pathname}`, url.pathname],
    method,
  );

  if (!implementation) {
    throw new Error("No mock data available for this endpoint.");
  }

  try {
    const result = await implementation(url, options);
    if (result instanceof Response) {
      return result;
    }

    return Response.json(result, {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    // eslint-disable-next-line @typescript-eslint/no-base-to-string
    console.error(`Error in mock implementation for the URL: ${input.toString()}`, error);
    return Response.json(
      { error: "Internal Server Error" },
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
};

/**
 * Registers or replaces a mock for a method and pathname in the shared registry.
 * Strings match exactly. Regular expressions must match the entire pathname or origin plus pathname.
 *
 * @param pathname - An exact pathname, origin plus pathname, or regular expression.
 * @param method - The HTTP method to match.
 * @param implementation - A function returning response data or a Response, synchronously or asynchronously.
 */
export const register = (
  pathname: Pathname.Type,
  method: Registry.Method,
  implementation: Registry.Implementation,
): void => {
  Registry.register(registry, pathname, method, implementation);
};

/** Clears all registrations in the shared mock registry. */
export const clear = (): void => {
  Registry.clear(registry);
};
