/**
 * Compatibility export for API client creation.
 *
 * @module endpoint
 */

import * as Fetcher from "./fetcher/Fetcher.ts";

/** @deprecated Use `Fetcher.make` instead. */
export const createEndpoint: typeof Fetcher.make = Fetcher.make;
