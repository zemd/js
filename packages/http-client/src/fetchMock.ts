/**
 * Compatibility exports for the shared fetch mock and its types.
 *
 * @module fetchMock
 */

import * as FetchMock from "./mock/FetchMock.ts";

/** @deprecated Use `FetchMock.fetch` instead. */
export const fetchMock: typeof FetchMock.fetch = FetchMock.fetch;

/** @deprecated Use `FetchMock.register` instead. */
export const addEndpointMock: typeof FetchMock.register = FetchMock.register;

/** @deprecated Use `FetchMock.clear` instead. */
export const clearEndpointMocks: typeof FetchMock.clear = FetchMock.clear;

/** @deprecated Use `FetchMock.Pathname` instead. */
export type TMockPathname = FetchMock.Pathname;

/** @deprecated Use `FetchMock.Method` instead. */
export type TMockMethod = FetchMock.Method;

/** @deprecated Use `FetchMock.Implementation` instead. */
export type TMockImplementation = FetchMock.Implementation;
