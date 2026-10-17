/**
 * Compilation, identification, and matching of mock endpoint pathnames.
 *
 * @module mock/Pathname
 */

/** An exact pathname (optionally including an origin), or an explicit regular expression. */
export type Type = string | RegExp;

/**
 * Anchors regular expressions and removes stateful flags for repeatable matching.
 *
 * @param pathname - An exact pathname or regular expression to compile.
 * @returns The unchanged string, or a new regular expression without `g` and `y` flags.
 */
export const compile = (pathname: Type): Type => {
  if (typeof pathname === "string") {
    return pathname;
  }

  const flags = pathname.flags.replaceAll("g", "").replaceAll("y", "");
  return new RegExp(`^(?:${pathname.source})$`, flags);
};

/**
 * Returns a stable registration key for a compiled pathname.
 *
 * @param pathname - The compiled pathname matcher.
 * @returns A key that distinguishes exact strings from regular expression sources and flags.
 */
export const key = (pathname: Type): string => {
  return typeof pathname === "string"
    ? `string:${pathname}`
    : `regexp:${pathname.source}/${pathname.flags}`;
};

/**
 * Checks a pathname against a compiled matcher.
 *
 * @param matcher - A matcher returned by `compile`.
 * @param pathname - The pathname or origin plus pathname to check.
 * @returns Whether the candidate matches the exact string or regular expression.
 */
export const matches = (matcher: Type, pathname: string): boolean => {
  return typeof matcher === "string" ? matcher === pathname : matcher.test(pathname);
};
