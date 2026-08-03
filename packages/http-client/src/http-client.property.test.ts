import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  checkHeaderInvariants,
  checkUrlInvariants,
  type THttpClientModule,
} from "@zemd/properties/http-client";
import * as client from "./index";

const contract: THttpClientModule = client;

const URL_TEMPLATES = [
  "https://example.com/a/b?x=1",
  "http://user:pass@example.com:8080/p/q",
  "https://example.com",
  "/relative/path?q=2",
  "//example.com/protocol-relative",
  "?only=query",
  "",
];

/**
 * Most random strings are not parseable URLs, so half of the inputs start from a realistic
 * one to keep the origin comparison reachable.
 */
const url = fc.oneof(
  fc.constantFrom(...URL_TEMPLATES),
  fc.tuple(fc.constantFrom(...URL_TEMPLATES), fc.string({ maxLength: 32 })).map(([base, tail]) => {
    return `${base}${tail}`;
  }),
  fc.string({ maxLength: 64 }),
  fc.webUrl(),
);

const HEADER_NAMES = [
  "Authorization",
  "Content-Type",
  "Cookie",
  "Host",
  "X-Forwarded-For",
  "X-Request-Id",
];

const METHOD_NAMES = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];

const HEADER_VALUES = ["application/json", "Bearer token", "1"];

const INJECTIONS = ["\r\n", "\n", "\r\nX-Injected: 1", "\r\n\r\n", "\0", " ", ":", ";"];

/**
 * The characters the invariants are about are vanishingly rare in random strings, so they
 * are injected explicitly alongside the realistic prefixes.
 */
const withInjection = (names: string[], maxLength: number): fc.Arbitrary<string> => {
  return fc.oneof(
    fc.constantFrom(...names),
    fc
      .tuple(
        fc.constantFrom(...names, ""),
        fc.constantFrom(...INJECTIONS),
        fc.string({ maxLength }),
      )
      .map((parts) => {
        return parts.join("");
      }),
    fc.string({ maxLength }),
  );
};

describe("http-client properties", () => {
  it("should never rewrite the origin of the request", async () => {
    await fc.assert(
      fc.asyncProperty(
        url,
        fc.string({ maxLength: 64 }),
        fc.dictionary(fc.string({ maxLength: 12 }), fc.string({ maxLength: 12 }), {
          maxKeys: 4,
        }),
        async (input, pathPrefix, queryParams) => {
          expect(await checkUrlInvariants(contract, input, pathPrefix, queryParams)).toEqual([]);
        },
      ),
      { numRuns: 1000 },
    );
  });

  it("should never emit a method or header carrying a control character", async () => {
    await fc.assert(
      fc.asyncProperty(
        withInjection(METHOD_NAMES, 32),
        withInjection(HEADER_NAMES, 48),
        withInjection(HEADER_VALUES, 64),
        async (methodName, headerName, headerValue) => {
          expect(
            await checkHeaderInvariants(contract, methodName, headerName, headerValue),
          ).toEqual([]);
        },
      ),
      { numRuns: 1000 },
    );
  });
});
