/**
 * Native errors with structured causes and JSON logging support.
 *
 * @module fetcher/FetcherError
 */

/** The stage that failed. Request failures include transport and transformer errors. */
export type ErrorKind = "request" | "http" | "parse";

/** The last URL and method forwarded through the transformer chain. */
export interface RequestMetadata {
  readonly url: string;
  readonly method: string;
}

/** Context retained when a request, HTTP status check, or response parser fails. */
export interface ErrorOptions {
  readonly kind: ErrorKind;
  readonly request: RequestMetadata;
  readonly response?: Response | undefined;
  /** Original transport, transformer, or parser failure. */
  readonly originalError?: unknown;
  readonly body?: unknown;
  readonly rawBody?: string | undefined;
  /** A failure reading or decoding an HTTP error body, without masking its status. */
  readonly bodyError?: unknown;
}

/** JSON values produced by the logging serializer. */
export type LogValue = null | boolean | number | string | LogValue[] | { [key: string]: LogValue };

/** Plain fields suitable for a structured logger. */
export type LogRecord = { readonly [key: string]: LogValue };

/**
 * Diagnostic fields stored in the native Error's `cause`.
 * `response` and `originalError` preserve the original objects for programmatic handling.
 * JSON serialization omits the live response and serializes underlying errors explicitly.
 */
export interface ErrorCause extends ErrorOptions {
  readonly source: "@zemd/http-client";
  readonly url: string;
  readonly method: string;
  readonly status: number | undefined;
  readonly statusText: string | undefined;
  readonly headers: Readonly<Record<string, string>> | undefined;
  readonly contentType: string | null | undefined;
  toJSON(): LogRecord;
}

/** A native Error with a typed cause; no custom Error constructor or prototype is used. */
export type FetcherError = Error & {
  readonly cause: ErrorCause;
  toJSON(): LogRecord;
};

/** Narrows unknown failures to native errors carrying API-client context. */
export const isError = (value: unknown): value is FetcherError => {
  if (!(value instanceof Error) || typeof value.cause !== "object" || value.cause === null) {
    return false;
  }
  const context = value.cause;
  return (
    "source" in context &&
    context.source === "@zemd/http-client" &&
    "kind" in context &&
    (context.kind === "request" || context.kind === "http" || context.kind === "parse") &&
    "request" in context &&
    typeof context.request === "object" &&
    context.request !== null &&
    "url" in context.request &&
    typeof context.request.url === "string" &&
    "method" in context.request &&
    typeof context.request.method === "string" &&
    "toJSON" in value &&
    typeof value.toJSON === "function" &&
    "toJSON" in context &&
    typeof context.toJSON === "function"
  );
};

/** Serialize thrown values without invoking user-defined toJSON methods or losing native Error fields. */
const logValue = (
  value: unknown,
  ancestors = new Set<object>(),
  depth = 0,
): LogValue | undefined => {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "bigint" || typeof value === "symbol") return String(value);
  if (typeof value !== "object") return undefined;
  if (ancestors.has(value)) return "[Circular]";
  if (depth >= 20) return "[MaxDepth]";

  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      return value.map((item: unknown) => logValue(item, ancestors, depth + 1) ?? null);
    }
    const fields: Record<string, unknown> = Object.fromEntries(Object.entries(value));
    if (value instanceof Error || value instanceof DOMException) {
      fields["name"] = value.name;
      fields["message"] = value.message;
      fields["stack"] = value.stack;
      if ("cause" in value) fields["cause"] = value.cause;
      if (value instanceof AggregateError) fields["errors"] = value.errors;
    }
    return Object.fromEntries(
      Object.entries(fields).flatMap(([key, item]) => {
        const serialized = logValue(item, ancestors, depth + 1);
        return serialized === undefined ? [] : [[key, serialized]];
      }),
    );
  } catch {
    return "[Unserializable]";
  } finally {
    ancestors.delete(value);
  }
};

/**
 * Returns a JSON-safe record including name, message, stack, and structured cause.
 * Preserves nested Error details and custom fields such as `code`; handles cycles and bigint.
 * Response metadata is snapshotted in `cause`; the live Response is never serialized or consumed.
 */
export const toLogRecord = (error: FetcherError): LogRecord => ({
  name: error.name,
  message: error.message,
  ...(error.stack === undefined ? {} : { stack: error.stack }),
  cause: logValue(error.cause) ?? null,
});

/** Creates an ordinary Error and builds all API diagnostics into its cause. */
export const make = (message: string, options: ErrorOptions): FetcherError => {
  const { response } = options;
  const details = {
    source: "@zemd/http-client" as const,
    kind: options.kind,
    request: { ...options.request },
    url: response?.url || options.request.url,
    method: options.request.method,
    status: response?.status,
    statusText: response?.statusText,
    headers: response === undefined ? undefined : Object.fromEntries(response.headers),
    contentType: response?.headers.get("Content-Type"),
    body: options.body,
    rawBody: options.rawBody,
    originalError: options.originalError,
    bodyError: options.bodyError,
  };
  const context = Object.defineProperties(details, {
    response: { value: response, enumerable: false },
    toJSON: { value: () => logValue(details), enumerable: false },
  }) as ErrorCause;
  const error = new Error(message, { cause: context });
  return Object.defineProperty(error, "toJSON", {
    value: () => toLogRecord(error as FetcherError),
    enumerable: false,
  }) as FetcherError;
};
