/**
 * Bounded, in-memory caching of eligible GET responses.
 *
 * @module transformers/Cache
 */

import type * as HttpClient from "../HttpClient.ts";

interface Entry {
  readonly response: Response;
  readonly timestamp: number;
}

const getRequestUrl = (input: string | URL | Request): string => {
  return input instanceof Request ? input.url : input.toString();
};

const getRequestMethod = (input: string | URL | Request, init?: RequestInit): string => {
  return (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
};

const getCacheKey = (input: string | URL | Request, init?: RequestInit): string => {
  const request = input instanceof Request ? input : undefined;
  const headers = new Headers(init?.headers ?? request?.headers);

  return JSON.stringify([
    getRequestUrl(input),
    Array.from(headers.entries()),
    init?.credentials ?? request?.credentials,
    init?.mode ?? request?.mode,
    init?.referrer ?? request?.referrer,
    init?.referrerPolicy ?? request?.referrerPolicy,
  ]);
};

const isCacheableResponse = (response: Response): boolean => {
  if (!response.ok) {
    return false;
  }

  const vary = response.headers.get("Vary");
  if (
    vary
      ?.split(",")
      .map((value) => {
        return value.trim();
      })
      .includes("*")
  ) {
    return false;
  }

  const cacheControlDirectives = response.headers
    .get("Cache-Control")
    ?.split(",")
    .map((directive) => {
      return directive.trim().split("=", 1)[0]?.toLowerCase();
    });

  return !cacheControlDirectives?.some((directive) => {
    return directive === "no-store" || directive === "no-cache" || directive === "private";
  });
};

/**
 * Creates a transformer with its own bounded, in-memory cache for successful GET responses.
 * Cache keys include the URL, caller-supplied headers, credentials, mode, and referrer settings.
 * Responses with `Vary: *` or Cache-Control directives `no-store`, `no-cache`, or `private`
 * are excluded. Cache hits return response clones and update the least-recently-used order.
 *
 * @param [maxAge=60000] - The maximum age of a cached response, in milliseconds.
 *   A non-positive value disables caching.
 * @param [maxEntries=100] - The maximum number of responses retained by this transformer.
 *   A non-positive value disables caching.
 * @returns A transformer that serves valid cache hits and otherwise delegates to the next client.
 *
 * @example
 * ```ts
 * import { Cache, HttpClient } from "@zemd/http-client";
 *
 * const client = HttpClient.make([Cache.make(30_000, 50)]);
 * ```
 */
export const make = (maxAge: number = 60_000, maxEntries: number = 100): HttpClient.Transformer => {
  const cacheStore = new Map<string, Entry>();

  return async (fetchFn: HttpClient.Type, ...params: HttpClient.Params) => {
    const [input, init] = params;
    if (getRequestMethod(input, init) !== "GET" || maxAge <= 0 || maxEntries <= 0) {
      return fetchFn(...params);
    }

    const cacheKey = getCacheKey(input, init);
    const cached = cacheStore.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < maxAge) {
      cacheStore.delete(cacheKey);
      cacheStore.set(cacheKey, cached);
      return cached.response.clone();
    }

    if (cached) {
      cacheStore.delete(cacheKey);
    }

    const response = await fetchFn(...params);
    if (!isCacheableResponse(response)) {
      return response;
    }

    let cachedResponse: Response;
    try {
      cachedResponse = response.clone();
    } catch {
      return response;
    }

    while (cacheStore.size >= maxEntries) {
      const oldestKey = cacheStore.keys().next().value;
      if (oldestKey === undefined) {
        break;
      }
      cacheStore.delete(oldestKey);
    }

    cacheStore.set(cacheKey, { response: cachedResponse, timestamp: Date.now() });
    return response;
  };
};
