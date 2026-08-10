export const copyAttributes = (
  sourceElement: Element,
  targetElement: Element,
  opts: Partial<{
    allowedAttributes: string[];
    forbiddenAttributes: string[];
  }> = {},
): void => {
  const { allowedAttributes = [], forbiddenAttributes = [] } = opts;
  for (const attr of sourceElement.attributes) {
    if (!allowedAttributes.includes(attr.name)) {
      continue;
    }
    if (forbiddenAttributes.includes(attr.name)) {
      continue;
    }
    targetElement.setAttributeNS(null, attr.name, attr.value);
  }
};

export * from "./dom/caret.ts";
export * from "./dom/check.ts";
export * from "./dom/cloneTree.ts";
export * from "./dom/removeNestedElementsWithTagName.ts";
export * from "./dom/selection.ts";

export * from "./dom/iterate/index.ts";
