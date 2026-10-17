/**
 * Compatibility export for creating a client from an ordered transformer list.
 *
 * @module compose
 */

import * as HttpClient from "./HttpClient.ts";

/** @deprecated Use `HttpClient.make` instead. */
export const compose: typeof HttpClient.make = HttpClient.make;
