import type { TFetchFnParams } from "./type";

export type TMockPathname = string | RegExp;
export type TMockMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "OPTIONS" | "HEAD";
export type TMockImplementation = (url: URL, options?: TFetchFnParams[1]) => unknown;

type TMockRegistration = {
  pathname: TMockPathname;
  method: TMockMethod;
  implementation: TMockImplementation;
};

const mockRegistry: TMockRegistration[] = [];

const getUrl = (url: TFetchFnParams[0]) => {
  if (url instanceof URL) {
    return url;
  }
  if (typeof url === "string") {
    return new URL(url);
  }
  return new URL(url.url);
};

const getMatcherKey = (pathname: TMockPathname): string => {
  return typeof pathname === "string"
    ? `string:${pathname}`
    : `regexp:${pathname.source}/${pathname.flags}`;
};

const compilePathname = (pathname: TMockPathname): TMockPathname => {
  if (typeof pathname === "string") {
    return pathname;
  }

  const flags = pathname.flags.replaceAll("g", "").replaceAll("y", "");
  return new RegExp(`^(?:${pathname.source})$`, flags);
};

const matchesPathname = (matcher: TMockPathname, pathname: string): boolean => {
  return typeof matcher === "string" ? matcher === pathname : matcher.test(pathname);
};

const getImplementation = (
  pathnames: string[],
  method: string,
): TMockImplementation | undefined => {
  for (const pathname of pathnames) {
    for (const registration of mockRegistry) {
      if (registration.method === method && matchesPathname(registration.pathname, pathname)) {
        return registration.implementation;
      }
    }
  }

  return undefined;
};

/**
 * Example usage:
 * ```ts
 * import { compose, prefix, method, json, fetchMock } from "@zemd/http-client";
 *
 * const mockData = true;
 *
 * const apiEndpoint = compose([
 *    prefix('/my/api/endpoint'),
 *    method('GET'),
 *    json()
 * ], mockData ? fetchMock : fetch);
 * ```
 */
export const fetchMock = async (
  url: TFetchFnParams[0],
  options?: TFetchFnParams[1],
): Promise<Response> => {
  const method = (options?.method ?? (url instanceof Request ? url.method : "GET")).toUpperCase();
  const urlObj = getUrl(url);

  const implementation = getImplementation(
    [`${urlObj.origin}${urlObj.pathname}`, urlObj.pathname],
    method,
  );

  if (implementation) {
    try {
      const result = await implementation(urlObj, options);
      if (result instanceof Response) {
        return result;
      }

      return Response.json(result, {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      // eslint-disable-next-line @typescript-eslint/no-base-to-string
      console.error(`Error in mock implementation for the URL: ${url.toString()}`, error);
      return Response.json(
        { error: "Internal Server Error" },
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
  }

  throw new Error("No mock data available for this endpoint.");
};

/**
 * Registers a mock implementation for a method and pathname.
 * String pathnames are matched exactly. Pass a RegExp explicitly for pattern matching; the
 * expression must match the entire pathname (or the entire origin plus pathname).
 */
export const addEndpointMock = (
  pathname: TMockPathname,
  method: TMockMethod,
  implementation: TMockImplementation,
) => {
  const compiledPathname = compilePathname(pathname);
  const matcherKey = getMatcherKey(compiledPathname);
  const existingIndex = mockRegistry.findIndex((registration) => {
    return registration.method === method && getMatcherKey(registration.pathname) === matcherKey;
  });
  const registration = { pathname: compiledPathname, method, implementation };

  if (existingIndex === -1) {
    mockRegistry.push(registration);
  } else {
    mockRegistry[existingIndex] = registration;
  }
};

export const clearEndpointMocks = () => {
  mockRegistry.length = 0;
};
