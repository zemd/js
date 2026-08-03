import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { compose, header, json, method, prefix, query } from "./index";
import type { TFetchFn } from "./type";

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

const CONTROL_CHARACTERS = ["\n", "\r", "\0"];

/**
 * The characters the properties are about are vanishingly rare in random strings, so they
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

const hasControlCharacter = (value: string): boolean => {
  return CONTROL_CHARACTERS.some((character) => {
    return value.includes(character);
  });
};

const originOf = (input: string | URL | Request): string | undefined => {
  const href = input instanceof Request ? input.url : input.toString();
  return URL.canParse(href) ? new URL(href).origin : undefined;
};

/**
 * Captures whatever the last transformer hands to `fetch` without performing a request.
 */
const sink = (): { fetchFn: TFetchFn; captured: () => Parameters<TFetchFn> | undefined } => {
  let seen: Parameters<TFetchFn> | undefined;
  return {
    fetchFn: async (...params) => {
      seen = params;
      return new Response(null, { status: 204 });
    },
    captured: () => {
      return seen;
    },
  };
};

/**
 * The transformers reject malformed input with a TypeError; only anything beyond that is a
 * finding.
 */
const withoutRejections = async (run: () => Promise<void>): Promise<void> => {
  try {
    await run();
  } catch (error) {
    if (!(error instanceof TypeError)) {
      throw error;
    }
  }
};

describe("url transformers", () => {
  it("should never rewrite the origin of the request", async () => {
    const queryParams = fc.dictionary(fc.string({ maxLength: 12 }), fc.string({ maxLength: 12 }), {
      maxKeys: 4,
    });

    await fc.assert(
      fc.asyncProperty(
        url,
        fc.string({ maxLength: 64 }),
        queryParams,
        async (input, path, params) => {
          await withoutRejections(async () => {
            const { fetchFn, captured } = sink();
            const originBefore = originOf(input);

            await compose([prefix(path), query(params)], fetchFn)(input);

            const sent = captured()?.[0];
            fc.pre(originBefore !== undefined && sent !== undefined);
            expect(originOf(sent as string | URL | Request)).toBe(originBefore);
          });
        },
      ),
      { numRuns: 2000 },
    );
  });

  it("should append every query parameter it is given", async () => {
    const queryParams = fc.dictionary(
      fc.string({ minLength: 1, maxLength: 12 }),
      fc.string({ maxLength: 12 }),
      { maxKeys: 4 },
    );

    await fc.assert(
      fc.asyncProperty(fc.webUrl(), queryParams, async (input, params) => {
        const { fetchFn, captured } = sink();

        await compose([query(params)], fetchFn)(input);

        const sent = captured()?.[0] as string;
        const search = new URL(sent).searchParams;
        for (const [name, value] of Object.entries(params)) {
          expect(search.getAll(name)).toContain(value);
        }
      }),
      { numRuns: 2000 },
    );
  });

  it("should preserve the parameters that were already on the url", async () => {
    const existing = fc.dictionary(
      fc.string({ minLength: 1, maxLength: 8 }),
      fc.string({ maxLength: 8 }),
      { maxKeys: 3 },
    );

    await fc.assert(
      fc.asyncProperty(fc.webUrl(), existing, existing, async (base, before, added) => {
        const original = new URL(base);
        original.search = `${new URLSearchParams(Object.entries(before))}`;
        const { fetchFn, captured } = sink();

        await compose([query(added)], fetchFn)(original.toString());

        const search = new URL(captured()?.[0] as string).searchParams;
        for (const [name, value] of Object.entries(before)) {
          expect(search.getAll(name)).toContain(value);
        }
      }),
      { numRuns: 2000 },
    );
  });
});

describe("method and header transformers", () => {
  it("should never emit a method or header carrying a control character", async () => {
    await fc.assert(
      fc.asyncProperty(
        withInjection(METHOD_NAMES, 32),
        withInjection(HEADER_NAMES, 48),
        withInjection(HEADER_VALUES, 64),
        async (methodName, headerName, headerValue) => {
          await withoutRejections(async () => {
            const { fetchFn, captured } = sink();

            await compose(
              [method(methodName), json(), header(headerName, headerValue)],
              fetchFn,
            )("https://example.com/");

            const init = captured()?.[1];
            const headers = (init?.headers ?? {}) as Record<string, string>;
            for (const [name, value] of Object.entries(headers)) {
              expect(hasControlCharacter(name)).toBe(false);
              expect(hasControlCharacter(value)).toBe(false);
            }
            expect(hasControlCharacter(init?.method ?? "")).toBe(false);
          });
        },
      ),
      { numRuns: 2000 },
    );
  });

  it("should either reject a method name or forward it verbatim", () => {
    fc.assert(
      fc.property(withInjection(METHOD_NAMES, 32), (name) => {
        let transformer: ReturnType<typeof method> | undefined;
        try {
          transformer = method(name);
        } catch (error) {
          expect(error).toBeInstanceOf(TypeError);
          return;
        }

        expect(transformer).toBeTypeOf("function");
        expect(/^[!#$%&'*+\-.^_`|~\dA-Za-z]+$/.test(name)).toBe(true);
      }),
      { numRuns: 2000 },
    );
  });

  it("should always set the json content type", async () => {
    const { fetchFn, captured } = sink();

    await compose([json()], fetchFn)("https://example.com/");

    const headers = (captured()?.[1]?.headers ?? {}) as Record<string, string>;
    expect(headers["content-type"]).toBe("application/json");
  });
});

describe("compose", () => {
  it("should pass the request through untouched when there is nothing to apply", async () => {
    await fc.assert(
      fc.asyncProperty(url, async (input) => {
        const { fetchFn, captured } = sink();

        await compose([], fetchFn)(input);

        expect(captured()?.[0]).toBe(input);
      }),
      { numRuns: 1000 },
    );
  });

  it("should apply the header transformers in the order they are listed", async () => {
    // `Headers` trims and joins values, so the tokens stay free of whitespace and commas.
    const token = fc.string({
      unit: fc.constantFrom("a", "b", "c", "0", "1", "2"),
      minLength: 1,
      maxLength: 8,
    });
    const values = fc.array(token, { minLength: 1, maxLength: 5 });

    await fc.assert(
      fc.asyncProperty(values, async (list) => {
        const { fetchFn, captured } = sink();
        const transformers = list.map((value) => {
          return header("X-Trace", value);
        });

        await compose(transformers, fetchFn)("https://example.com/");

        const headers = captured()?.[1]?.headers as Record<string, string>;
        expect(headers["x-trace"]).toBe(list.join(", "));
      }),
      { numRuns: 2000 },
    );
  });
});
