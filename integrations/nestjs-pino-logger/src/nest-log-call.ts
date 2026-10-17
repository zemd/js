import type { LogLevel } from "@nestjs/common";

export interface ParsedNestLogCall {
  readonly context: string | undefined;
  readonly messages: readonly unknown[];
  readonly params: Readonly<Record<string, unknown>> | undefined;
  readonly stack: string | undefined;
}

type ParsedMessages = Omit<ParsedNestLogCall, "stack">;

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (value === null || typeof value !== "object") {
    return false;
  }

  const prototype: object | null = Object.getPrototypeOf(value);
  if (prototype === null) {
    return true;
  }

  const constructor: unknown = Reflect.get(prototype, "constructor");
  return (
    Object.hasOwn(prototype, "constructor") &&
    typeof constructor === "function" &&
    constructor instanceof constructor &&
    Function.prototype.toString.call(constructor) === Function.prototype.toString.call(Object)
  );
};

const parseMessagesAndContext = (values: readonly unknown[]): ParsedMessages => {
  if (values.length <= 1) {
    return { context: undefined, messages: values, params: undefined };
  }

  const lastValue = values.at(-1);
  const context = typeof lastValue === "string" ? lastValue : undefined;
  const remainingValues = context === undefined ? values : values.slice(0, -1);
  const messages: unknown[] = [remainingValues[0]];
  let params: Record<string, unknown> | undefined;

  for (const value of remainingValues.slice(1)) {
    if (isPlainObject(value)) {
      // Object spread keeps __proto__ as data instead of invoking its setter.
      params = { ...params, ...value };
    } else {
      messages.push(value);
    }
  }

  return { context, messages, params };
};

const isStackFormat = (value: unknown): value is string => {
  return typeof value === "string" && /^(.)+\n\s+at .+:\d+:\d+/u.test(value);
};

/** Mirrors the argument parsing performed by NestJS ConsoleLogger. */
export const parseNestLogCall = (
  level: LogLevel,
  message: unknown,
  optionalParameters: readonly unknown[],
): ParsedNestLogCall => {
  const values = [message, ...optionalParameters];
  if (level !== "error" && level !== "fatal") {
    const parsed = parseMessagesAndContext(values);
    return { ...parsed, stack: undefined };
  }

  if (values.length === 2) {
    if (isStackFormat(values[1])) {
      return {
        context: undefined,
        messages: [values[0]],
        params: undefined,
        stack: values[1],
      };
    }

    const parsed = parseMessagesAndContext(values);
    return { ...parsed, stack: undefined };
  }

  const trailingValue = values.at(-1);
  if (isStackFormat(trailingValue)) {
    return {
      ...parseMessagesAndContext(values.slice(0, -1)),
      stack: trailingValue,
    };
  }

  const parsed = parseMessagesAndContext(values);
  if (parsed.messages.length <= 1) {
    return { ...parsed, stack: undefined };
  }

  const stack = parsed.messages.at(-1);
  if (typeof stack !== "string" && stack !== undefined) {
    return { ...parsed, stack: undefined };
  }

  return {
    context: parsed.context,
    messages: parsed.messages.slice(0, -1),
    params: parsed.params,
    stack,
  };
};
