/**
 * Mutable storage and lookup of mock endpoint registrations.
 *
 * @module mock/Registry
 */

import type * as HttpClient from "../HttpClient.ts";
import * as Pathname from "./Pathname.ts";

/** HTTP methods supported by mock endpoint registrations. */
export type Method = "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "OPTIONS" | "HEAD" | "QUERY";

/**
 * Supplies the response or data for a matching mock request.
 *
 * @param url - The parsed request URL, including its query parameters.
 * @param [options] - The request options passed to the mock client.
 * @returns Response data, a native Response, or a promise of either.
 */
export type Implementation = (url: URL, options?: HttpClient.Params[1]) => unknown;

interface Registration {
  readonly pathname: Pathname.Type;
  readonly method: Method;
  readonly implementation: Implementation;
}

/** A mutable list of compiled endpoint registrations in insertion order. */
export type Type = Array<Registration>;

/**
 * Creates an empty mock endpoint registry.
 *
 * @returns A new registry with no shared registrations.
 */
export const make = (): Type => [];

/**
 * Adds or replaces a registration, mutating the registry in place.
 * Replacement preserves the original registration's position in the lookup order.
 *
 * @param self - The registry to update.
 * @param pathname - An exact pathname or regular expression to compile.
 * @param method - The HTTP method to match, normalized to uppercase.
 * @param implementation - The implementation used for matching requests.
 */
export const register = (
  self: Type,
  pathname: Pathname.Type,
  method: Method,
  implementation: Implementation,
): void => {
  const compiledPathname = Pathname.compile(pathname);
  const normalizedMethod = method.toUpperCase() as Method;
  const matcherKey = Pathname.key(compiledPathname);
  const existingIndex = self.findIndex((registration) => {
    return (
      registration.method === normalizedMethod && Pathname.key(registration.pathname) === matcherKey
    );
  });
  const registration: Registration = {
    pathname: compiledPathname,
    method: normalizedMethod,
    implementation,
  };

  if (existingIndex === -1) {
    self.push(registration);
  } else {
    self[existingIndex] = registration;
  }
};

/**
 * Looks up candidates in order, preserving registration order within each candidate.
 *
 * @param self - The registry to search.
 * @param pathnames - Candidate pathnames in priority order.
 * @param method - The normalized, uppercase HTTP method to match.
 * @returns The first matching implementation, or `undefined` if no registration matches.
 */
export const find = (
  self: Type,
  pathnames: ReadonlyArray<string>,
  method: string,
): Implementation | undefined => {
  for (const pathname of pathnames) {
    for (const registration of self) {
      if (registration.method === method && Pathname.matches(registration.pathname, pathname)) {
        return registration.implementation;
      }
    }
  }

  return undefined;
};

/**
 * Removes all registrations, mutating the registry in place.
 *
 * @param self - The registry to clear.
 */
export const clear = (self: Type): void => {
  self.length = 0;
};
