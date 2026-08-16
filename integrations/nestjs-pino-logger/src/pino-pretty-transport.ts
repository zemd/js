import cleanStack from "clean-stack";
import ms from "ms";
import pinoPretty from "pino-pretty";

export type PinoPrettyTransportOptions = Pick<
  pinoPretty.PrettyOptions,
  "append" | "colorize" | "crlf" | "destination" | "mkdir" | "singleLine" | "sync"
>;

type LogDescriptor = Record<string, unknown>;

interface SerializedError {
  readonly message: string;
  readonly stack?: string;
  readonly type: string;
}

const contextColors = [
  20, 21, 26, 27, 32, 33, 38, 39, 40, 41, 42, 43, 44, 45, 56, 57, 62, 63, 68, 69, 74, 75, 76, 77,
  78, 79, 80, 81, 92, 93, 98, 99, 112, 113, 128, 129, 134, 135, 148, 149, 160, 161, 162, 163, 164,
  165, 166, 167, 168, 169, 170, 171, 172, 173, 178, 179, 184, 185, 196, 197, 198, 199, 200, 201,
  202, 203, 204, 205, 206, 207, 208, 209, 214, 215, 220, 221,
] as const;

const levelLabels: Readonly<Record<number, string>> = {
  60: "fatal",
  50: "error",
  40: "warn",
  30: "log",
  20: "debug",
  10: "verbose",
};

const levelColorCodes: Readonly<Record<string, readonly number[]>> = {
  fatal: [31, 1],
  error: [31],
  warn: [33],
  log: [32],
  debug: [35],
  verbose: [34],
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return value !== null && typeof value === "object" && !Array.isArray(value);
};

const toStringValue = (value: unknown, fallback: string): string => {
  if (value === null || value === undefined) {
    return fallback;
  }

  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "bigint" || typeof value === "boolean") {
    return value.toString();
  }
  if (typeof value === "symbol") {
    return value.description ?? fallback;
  }
  if (typeof value === "function") {
    return value.name || fallback;
  }

  try {
    return JSON.stringify(value) ?? fallback;
  } catch {
    return fallback;
  }
};

const escapeCodePoint = (codePoint: number): string => {
  return codePoint <= 0xffff
    ? `\\u${codePoint.toString(16).padStart(4, "0")}`
    : `\\u{${codePoint.toString(16)}}`;
};

const isUnsafeCodePoint = (codePoint: number): boolean => {
  return (
    codePoint <= 0x1f ||
    (codePoint >= 0x7f && codePoint <= 0x9f) ||
    codePoint === 0x061c ||
    codePoint === 0x200e ||
    codePoint === 0x200f ||
    (codePoint >= 0x2028 && codePoint <= 0x202e) ||
    (codePoint >= 0x2066 && codePoint <= 0x2069)
  );
};

const sanitizeText = (value: unknown, allowNewlines: boolean, fallback = "unknown"): string => {
  let output = "";
  for (const character of toStringValue(value, fallback)) {
    const codePoint = character.codePointAt(0);
    if (codePoint === undefined) {
      continue;
    }
    if (allowNewlines && codePoint === 0x0a) {
      output += character;
    } else if (isUnsafeCodePoint(codePoint)) {
      output += escapeCodePoint(codePoint);
    } else {
      output += character;
    }
  }
  return output;
};

const paint = (value: string, codes: readonly (number | string)[], enabled: boolean): string => {
  return enabled ? `\u001B[${codes.join(";")}m${value}\u001B[0m` : value;
};

const selectContextColor = (context: string): number => {
  let hash = 0;
  for (const character of context) {
    hash = ((hash << 5) - hash + (character.codePointAt(0) ?? 0)) | 0;
  }
  return contextColors[Math.abs(hash) % contextColors.length] ?? contextColors[0];
};

const toTimestamp = (value: unknown): number | undefined => {
  const timestamp =
    typeof value === "number" ? value : typeof value === "string" ? Date.parse(value) : Number.NaN;
  if (!Number.isFinite(timestamp)) {
    return undefined;
  }
  return Number.isNaN(new Date(timestamp).getTime()) ? undefined : timestamp;
};

const formatDuration = (value: unknown): string | undefined => {
  return typeof value === "number" && Number.isFinite(value) ? ms(Math.max(0, value)) : undefined;
};

const readLevel = (log: LogDescriptor, levelLabelKey: string): string => {
  const level = log["level"];
  if (typeof level === "number") {
    return levelLabels[level] ?? toStringValue(log[levelLabelKey], level.toString());
  }
  if (typeof level === "string") {
    return level;
  }
  return toStringValue(log[levelLabelKey], "unknown");
};

const prefixLines = (value: string, prefix: string, singleLine: boolean): string => {
  return singleLine ? value : value.split("\n").join(`\n${prefix}`);
};

const readError = (value: unknown): SerializedError | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }

  const message = sanitizeText(value["message"], false, "Unknown error");
  const type = sanitizeText(value["type"], false, "Error");
  const stackValue = value["stack"];
  return {
    message,
    ...(typeof stackValue === "string" ? { stack: stackValue } : {}),
    type,
  };
};

const formatError = (error: SerializedError, colorize: boolean, singleLine: boolean): string => {
  const title = `${error.type}: ${error.message}`;
  if (!error.stack) {
    return paint(title, [31, 1], colorize);
  }

  const stackLines = sanitizeText(error.stack, true, "").split("\n");
  if (stackLines[0] === title || stackLines[0]?.endsWith(`: ${error.message}`)) {
    stackLines.shift();
  }
  const cleanedStack = cleanStack(stackLines.join("\n"), {
    basePath: process.cwd(),
    pretty: true,
  });
  const stackBody = singleLine ? cleanedStack.split("\n").join("\\n") : cleanedStack;
  return stackBody
    ? `${paint(title, [31, 1], colorize)} ${paint(stackBody, [31, 2], colorize)}`
    : paint(title, [31, 1], colorize);
};

const formatHttpSummary = (log: LogDescriptor, colorize: boolean): string | undefined => {
  const request = log["req"];
  const response = log["res"];
  if (!isRecord(request) || !isRecord(response)) {
    return undefined;
  }

  const requestId = paint(sanitizeText(request["id"], false), [2], colorize);
  const method = paint(sanitizeText(request["method"], false), [32, 1], colorize);
  const url = sanitizeText(request["url"], false);
  const statusCode = paint(sanitizeText(response["statusCode"], false), [34], colorize);
  const responseTime = formatDuration(log["responseTime"]);
  const formattedResponseTime = responseTime ? ` (⮂ ${paint(responseTime, [32], colorize)})` : "";
  return `${requestId} › ${method} ${url} ${statusCode}${formattedResponseTime}`;
};

export default (options: PinoPrettyTransportOptions = {}): pinoPretty.PrettyStream => {
  const colorize = options.colorize === true;
  const singleLine = options.singleLine === true;
  let lastTimestamp: number | undefined;

  const messageFormat = (log: LogDescriptor, _messageKey: string, levelLabel: string): string => {
    try {
      const context = sanitizeText(log["context"], false);
      const contextColor = selectContextColor(context);
      const timestamp = toTimestamp(log["time"]);
      const level = sanitizeText(readLevel(log, levelLabel), false).toLowerCase();
      const timestampText =
        timestamp === undefined
          ? undefined
          : paint(new Date(timestamp).toISOString(), [90], colorize);
      const contextText = paint(context, [`38;5;${contextColor}`, 1], colorize);
      const levelText = paint(level, levelColorCodes[level] ?? [37], colorize);
      const prefix = `${timestampText ? `${timestampText} ` : ""}${contextText}.${levelText} › `;
      const output: string[] = [];

      const httpSummary = formatHttpSummary(log, colorize);
      if (httpSummary) {
        output.push(httpSummary);
      } else {
        const rawMessage = log["msg"] ?? log["formattedMsg"];
        const message = sanitizeText(rawMessage, !singleLine, "");
        if (message) {
          output.push(message);
        }
      }

      const error = readError(log["err"]);
      if (error) {
        output.push(formatError(error, colorize, singleLine));
      }

      if (output.length === 0) {
        output.push("(no message)");
      }

      const separator = singleLine ? " | " : `\n${prefix}`;
      const body = output
        .map((part) => {
          return prefixLines(part, prefix, singleLine);
        })
        .join(separator);

      const difference =
        timestamp === undefined || lastTimestamp === undefined
          ? timestamp === undefined
            ? undefined
            : 0
          : Math.max(0, timestamp - lastTimestamp);
      if (timestamp !== undefined) {
        lastTimestamp = timestamp;
      }
      const duration = formatDuration(difference);
      const suffix = duration
        ? ` ${paint(`+${duration}`, [`38;5;${contextColor}`], colorize)}`
        : "";
      return `${prefix}${body}${suffix}`;
    } catch {
      return sanitizeText(log["msg"], !singleLine, "Unable to format log record");
    }
  };

  return pinoPretty({
    ...options,
    colorize: false,
    hideObject: true,
    levelKey: "__zemdLevel",
    messageFormat,
    messageKey: "__zemdMessage",
    timestampKey: "__zemdTime",
  });
};
