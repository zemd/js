import { formatWithOptions } from "node:util";

/**
 * Combines a message and interpolation values into one string before it is
 * passed to a NestJS-compatible logger.
 */
export const formatLogMessage = (message: unknown, ...parameters: unknown[]): string => {
  return formatWithOptions({ colors: false }, message, ...parameters);
};
