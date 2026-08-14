interface LiteralPart {
  readonly value: string;
  readonly type: "literal";
}

interface TokenPart {
  readonly argument: string | undefined;
  readonly key: string;
  readonly type: "token";
}

type FormatPart = LiteralPart | TokenPart;

export type FormatTransformer<Context, Info> = (
  context: Context,
  info: Info,
  ...arguments_: any[]
) => string;

const trimLogMessage = (message: string): string => {
  let result = message.trim();
  while (result.startsWith("-")) result = result.slice(1);
  while (result.endsWith("-")) result = result.slice(0, -1);
  return result.replace(/\s+/g, " ");
};

const parse = (format: string): readonly FormatPart[] => {
  const token = /:([-\w]{2,})(?:\[([^\]]+)\])?/g;
  const parts: FormatPart[] = [];
  let offset = 0;

  for (const match of format.matchAll(token)) {
    const index = match.index;
    const source = match[0];
    const key = match[1];
    if (index === undefined || !source || !key) continue;
    if (index > offset) parts.push({ type: "literal", value: format.slice(offset, index) });
    parts.push({ type: "token", key, argument: match[2] });
    offset = index + source.length;
  }
  if (offset < format.length) parts.push({ type: "literal", value: format.slice(offset) });
  return parts;
};

const transform = <Context, Info>(
  part: TokenPart,
  transformers: Partial<Record<string, FormatTransformer<Context, Info>>>,
  context: Context,
  info: Info,
): string => {
  const transformer = Object.hasOwn(transformers, part.key) ? transformers[part.key] : undefined;
  return transformer?.(context, info, part.argument) ?? "";
};

// Parse once, then interpret literals and known transformer tokens without
// generating executable source. Transformer calls remain separate for message
// rendering and structured fields, matching the original public behavior.
export const compileFormat = <Context, Info>(format: string) => {
  const parts = parse(format);
  const tokens = parts.filter((part): part is TokenPart => part.type === "token");

  return (
    transformers: Partial<Record<string, FormatTransformer<Context, Info>>>,
    context: Context,
    info: Info,
  ): { readonly message: string } & Readonly<Record<string, string>> => {
    const message = trimLogMessage(
      parts
        .map((part) =>
          part.type === "literal" ? part.value : transform(part, transformers, context, info),
        )
        .join(""),
    );
    const result: Record<string, string> & { message: string } = { message };
    for (const part of tokens) {
      Object.defineProperty(result, part.key, {
        configurable: true,
        enumerable: true,
        value: transform(part, transformers, context, info),
        writable: true,
      });
    }
    return result;
  };
};
