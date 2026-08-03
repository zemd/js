type TFetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
type TTransformer = (
  fetchFn: TFetch,
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

/**
 * The `@zemd/http-client` surface under contract. It is declared structurally rather than
 * imported so that this package stays dependency free and the workspace graph acyclic.
 */
export type THttpClientModule = {
  compose: (transformers: TTransformer[], fetchFn?: TFetch) => TFetch;
  prefix: (value: string) => TTransformer;
  query: (obj: object) => TTransformer;
  method: (name: string) => TTransformer;
  header: (key: string, value: string) => TTransformer;
  json: () => TTransformer;
};

const CONTROL_CHARACTERS = ["\n", "\r", "\0"];

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
 * The transformers reject malformed input with a TypeError; only anything beyond that is a
 * finding, so both drivers treat it the same way.
 */
const withoutRejections = async (fn: () => Promise<string[]>): Promise<string[]> => {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof TypeError) {
      return [];
    }
    throw error;
  }
};

/**
 * The URL rewriting transformers must never redirect a request to another origin, otherwise
 * attacker controlled path or query values become an SSRF primitive.
 */
export const checkUrlInvariants = async (
  client: THttpClientModule,
  url: string,
  pathPrefix: string,
  queryParams: object,
): Promise<string[]> => {
  return withoutRejections(async () => {
    const violations: string[] = [];
    let captured: string | URL | Request | undefined;
    const sink: TFetch = async (input) => {
      captured = input;
      return new Response(null, { status: 204 });
    };

    const originBefore = originOf(url);
    const fetchFn = client.compose([client.prefix(pathPrefix), client.query(queryParams)], sink);
    await fetchFn(url);

    if (originBefore === undefined || captured === undefined) {
      return violations;
    }

    const originAfter = originOf(captured);
    if (originAfter !== originBefore) {
      violations.push(
        `origin ${originBefore} became ${String(originAfter)} for ${JSON.stringify(url)}`,
      );
    }

    return violations;
  });
};

/**
 * `method()`, `header()` and `json()` build the outgoing request themselves, so they must
 * never emit a method, header name or header value containing CR/LF or NUL: that is the
 * classic header injection and request splitting primitive.
 */
export const checkHeaderInvariants = async (
  client: THttpClientModule,
  methodName: string,
  headerName: string,
  headerValue: string,
): Promise<string[]> => {
  return withoutRejections(async () => {
    const violations: string[] = [];
    let captured: RequestInit | undefined;
    const sink: TFetch = async (_input, init) => {
      captured = init;
      return new Response(null, { status: 204 });
    };

    const fetchFn = client.compose(
      [client.method(methodName), client.json(), client.header(headerName, headerValue)],
      sink,
    );
    await fetchFn("https://example.com/");

    const headers = captured?.headers as Record<string, string> | undefined;
    for (const [name, value] of Object.entries(headers ?? {})) {
      if (hasControlCharacter(name) || hasControlCharacter(value)) {
        violations.push(`header injection: ${JSON.stringify(name)}: ${JSON.stringify(value)}`);
      }
    }
    if (typeof captured?.method === "string" && hasControlCharacter(captured.method)) {
      violations.push(`method injection: ${JSON.stringify(captured.method)}`);
    }

    return violations;
  });
};
