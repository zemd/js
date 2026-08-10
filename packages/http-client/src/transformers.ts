import type { TFetchFn, TFetchFnParams, TFetchTransformer } from "./type";

const transform = async (
  fetchFn: TFetchFn,
  params: TFetchFnParams,
  input: RequestInit,
): Promise<Response> => {
  const [urlOrRequest, requestInit] = params;
  return fetchFn(urlOrRequest, {
    ...requestInit,
    ...input,
  });
};

/**
 * RFC 9110 token: the only characters allowed in an HTTP method name.
 */
const HTTP_TOKEN = /^[!#$%&'*+\-.^_`|~\dA-Za-z]+$/;

/**
 * Set the HTTP method for the request.
 * @param name The HTTP method name (e.g., 'GET', 'POST', 'PUT', 'DELETE', etc.)
 * @returns A transformer function that sets the specified HTTP method
 * @throws {TypeError} When the name is not a valid RFC 9110 method token
 */
export const method = (name: string): TFetchTransformer => {
  if (!HTTP_TOKEN.test(name)) {
    throw new TypeError("Invalid HTTP method name.", { cause: { received: name } });
  }

  return async (fetchFn: TFetchFn, ...params: TFetchFnParams): Promise<Response> => {
    return transform(fetchFn, params, { method: name });
  };
};

/**
 * Add a header to the request.
 * @param key The header key
 * @param value The header value
 * @returns A transformer function that adds the specified header
 */
export const header = (key: string, value: string): TFetchTransformer => {
  return async (fetchFn: TFetchFn, ...params: TFetchFnParams) => {
    const [urlOrRequest, requestInit] = params;

    const headers = new Headers(requestInit?.headers);
    headers.append(key, value);

    return fetchFn(
      urlOrRequest,
      Object.assign(requestInit ?? {}, {
        headers: Object.fromEntries(headers.entries()),
      }),
    );
  };
};

/**
 * Set the Content-Type header to 'application/json'.
 * @returns A transformer function that adds the JSON Content-Type header
 */
export const json = (): TFetchTransformer => {
  return header("Content-Type", "application/json");
};

const modifyUrlPath = (input: TFetchFnParams[0], prefix: string): TFetchFnParams[0] => {
  if (input instanceof Request) {
    const urlObj = new URL(input.url);
    urlObj.pathname = `${prefix}${urlObj.pathname}`;

    return new Request(urlObj.toString(), input);
  }

  if (input instanceof URL) {
    const urlObj = new URL(input.toString());
    urlObj.pathname = `${prefix}${urlObj.pathname}`;
    return urlObj;
  }

  // typeof input === 'string'
  if (URL.canParse(input)) {
    const urlObj = new URL(input);
    urlObj.pathname = `${prefix}${urlObj.pathname}`;
    return urlObj.toString();
  }

  return `${prefix}${input}`;
};

const modifyUrlQuery = (input: TFetchFnParams[0], query: object): TFetchFnParams[0] => {
  if (input instanceof Request) {
    const urlObj = new URL(input.url);
    urlObj.search = `${new URLSearchParams([...Array.from(urlObj.searchParams.entries()), ...Object.entries(query)])}`;
    return new Request(urlObj.toString(), input);
  }

  if (input instanceof URL) {
    const urlObj = new URL(input);
    urlObj.search = `${new URLSearchParams([...Array.from(urlObj.searchParams.entries()), ...Object.entries(query)])}`;
    return urlObj;
  }

  // typeof input === 'string'
  if (URL.canParse(input)) {
    const urlObj = new URL(input);
    urlObj.search = `${new URLSearchParams([...Array.from(urlObj.searchParams.entries()), ...Object.entries(query)])}`;
    return urlObj.toString();
  }

  const [pathname, search] = input.split("?");
  return `${pathname ?? ""}?${new URLSearchParams([...new URLSearchParams(search).entries(), ...Object.entries(query)])}`;
};

/**
 * Sets the URL prefix for the request.
 * @param input The path to be added to the URL path in the beginning
 * @returns A transformer function that adds the specified prefix
 */
export const prefix = (value: string): TFetchTransformer => {
  return async (fetchFn: TFetchFn, ...params: TFetchFnParams) => {
    const [urlOrRequest, requestInit] = params;

    return fetchFn(modifyUrlPath(urlOrRequest, value), requestInit);
  };
};

/**
 * Adds query parameters to the request URL.
 * @param obj An object containing the query parameters as key-value pairs
 * @returns A transformer function that adds the specified query parameters to the URL
 */
export const query = (obj: object): TFetchTransformer => {
  return async (fetchFn: TFetchFn, ...params: TFetchFnParams) => {
    const [urlOrRequest, requestInit] = params;
    return fetchFn(modifyUrlQuery(urlOrRequest, obj), requestInit);
  };
};

/**
 * Sets the request body.
 * @param obj The body to be sent with the request
 * @returns A transformer function that sets the specified body
 */
export const body = (obj: BodyInit): TFetchTransformer => {
  return async (fetchFn: TFetchFn, ...params: TFetchFnParams) => {
    const [urlOrRequest, requestInit] = params;
    return fetchFn(
      urlOrRequest,
      Object.assign(requestInit ?? {}, {
        body: obj,
      }),
    );
  };
};

export type TShouldRetry = (error: unknown, attempt: number) => boolean;

const shouldRetryByDefault: TShouldRetry = (error) => {
  if (error instanceof Response) {
    return error.status >= 500 && error.status <= 599;
  }

  if (error instanceof Error && error.name === "AbortError") {
    return false;
  }

  return (
    error instanceof TypeError ||
    (typeof DOMException !== "undefined" &&
      error instanceof DOMException &&
      error.name === "NetworkError")
  );
};

const wait = async (delay: number): Promise<void> => {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, delay);
  });
};

const cancelResponseBody = async (response: Response): Promise<void> => {
  try {
    await response.body?.cancel();
  } catch {
    // Failure to release a discarded response body must not replace the request result.
  }
};

/**
 * Creates a transformer that retries network failures and 5xx responses by default.
 * @param maxRetries The maximum number of retries after the initial attempt (default: 3)
 * @param delay The delay between attempts in milliseconds (default: 1000)
 * @param backoffFactor A delay multiplier or a function receiving the zero-based retry index
 * @param shouldRetry A predicate receiving a thrown error or non-ok Response and the one-based attempt number
 * @returns A transformer function that retries the request on eligible failures
 */
export const retry = (
  maxRetries: number = 3,
  delay: number = 1000,
  backoffFactor: number | ((attempt: number) => number) = 1,
  shouldRetry: TShouldRetry = shouldRetryByDefault,
): TFetchTransformer => {
  return async (fetchFn: TFetchFn, ...params: TFetchFnParams) => {
    let retries = 0;

    while (true) {
      let response: Response;
      try {
        response = await fetchFn(...params);
      } catch (error) {
        if (retries >= maxRetries || !shouldRetry(error, retries + 1)) {
          throw error;
        }

        const backoffDelay =
          delay * (typeof backoffFactor === "number" ? backoffFactor : backoffFactor(retries));
        await wait(backoffDelay);
        retries += 1;
        continue;
      }

      if (response.ok || retries >= maxRetries || !shouldRetry(response, retries + 1)) {
        return response;
      }

      await cancelResponseBody(response);
      const backoffDelay =
        delay * (typeof backoffFactor === "number" ? backoffFactor : backoffFactor(retries));
      await wait(backoffDelay);
      retries += 1;
    }
  };
};

type TCacheEntry = {
  response: Response;
  timestamp: number;
};

const getRequestUrl = (input: string | URL | Request): string => {
  return input instanceof Request ? input.url : input.toString();
};

const getRequestMethod = (input: string | URL | Request, init?: RequestInit): string => {
  return (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
};

const getCacheKey = (input: string | URL | Request, init?: RequestInit): string => {
  const request = input instanceof Request ? input : undefined;
  const headers = new Headers(init?.headers ?? request?.headers);

  return JSON.stringify([
    getRequestUrl(input),
    Array.from(headers.entries()),
    init?.credentials ?? request?.credentials,
    init?.mode ?? request?.mode,
    init?.referrer ?? request?.referrer,
    init?.referrerPolicy ?? request?.referrerPolicy,
  ]);
};

const isCacheableResponse = (response: Response): boolean => {
  if (!response.ok) {
    return false;
  }

  const vary = response.headers.get("Vary");
  if (
    vary
      ?.split(",")
      .map((value) => {
        return value.trim();
      })
      .includes("*")
  ) {
    return false;
  }

  const cacheControlDirectives = response.headers
    .get("Cache-Control")
    ?.split(",")
    .map((directive) => {
      return directive.trim().split("=", 1)[0]?.toLowerCase();
    });

  return !cacheControlDirectives?.some((directive) => {
    return directive === "no-store" || directive === "no-cache" || directive === "private";
  });
};

/**
 * Creates an isolated, in-memory cache for GET responses. Cache keys include the URL,
 * caller-supplied headers, and request options that can affect the representation.
 * @param maxAge The maximum age of the cache in milliseconds (default: 60000 ms or 1 minute)
 * @param maxEntries The maximum number of responses retained by this transformer (default: 100)
 * @returns A transformer function that caches GET requests and returns cached responses if available
 */
export const cache = (maxAge: number = 60_000, maxEntries: number = 100): TFetchTransformer => {
  const cacheStore = new Map<string, TCacheEntry>();

  return async (fetchFn: TFetchFn, ...params: TFetchFnParams) => {
    const [input, init] = params;
    if (getRequestMethod(input, init) !== "GET" || maxAge <= 0 || maxEntries <= 0) {
      return fetchFn(...params);
    }

    const cacheKey = getCacheKey(input, init);
    const cached = cacheStore.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < maxAge) {
      cacheStore.delete(cacheKey);
      cacheStore.set(cacheKey, cached);
      return cached.response.clone();
    }

    if (cached) {
      cacheStore.delete(cacheKey);
    }

    const response = await fetchFn(...params);
    if (!isCacheableResponse(response)) {
      return response;
    }

    let cachedResponse: Response;
    try {
      cachedResponse = response.clone();
    } catch {
      return response;
    }

    while (cacheStore.size >= maxEntries) {
      const oldestKey = cacheStore.keys().next().value;
      if (oldestKey === undefined) {
        break;
      }
      cacheStore.delete(oldestKey);
    }

    cacheStore.set(cacheKey, { response: cachedResponse, timestamp: Date.now() });
    return response;
  };
};

const consoleDebug = (p: any) => {
  console.debug(JSON.stringify(p, null, 4));
};

/**
 * Creates a transformer that logs request parameters for debugging purposes.
 * @param fn Optional custom logging function (defaults to console.debug with JSON.stringify)
 * @returns A transformer function that logs the request parameters before passing them to the next transformer
 */
export const debug = (fn: Function = consoleDebug): TFetchTransformer => {
  return async (fetchFn: TFetchFn, ...params: TFetchFnParams) => {
    fn(params);
    return fetchFn(...params);
  };
};
