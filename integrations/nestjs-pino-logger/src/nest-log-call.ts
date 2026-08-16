import type { LogLevel } from "@nestjs/common";

export interface ParsedNestLogCall {
  readonly context: string | undefined;
  readonly messages: readonly unknown[];
  readonly stack: string | undefined;
}

interface ParsedMessages {
  readonly context: string | undefined;
  readonly messages: readonly unknown[];
}

const parseMessagesAndContext = (values: readonly unknown[]): ParsedMessages => {
  if (values.length <= 1 || typeof values.at(-1) !== "string") {
    return { context: undefined, messages: values };
  }

  return {
    context: values.at(-1) as string,
    messages: values.slice(0, -1),
  };
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
  if (level !== "error") {
    const parsed = parseMessagesAndContext(values);
    return { ...parsed, stack: undefined };
  }

  if (values.length === 2) {
    if (isStackFormat(values[1])) {
      return {
        context: undefined,
        messages: [values[0]],
        stack: values[1],
      };
    }

    const parsed = parseMessagesAndContext(values);
    return { ...parsed, stack: undefined };
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
    stack,
  };
};
