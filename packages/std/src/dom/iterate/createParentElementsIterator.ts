import { isBlockElement, isHTMLElement } from "../check.ts";

export const createParentElementsIterator = function* (node: Node): Generator<HTMLElement> {
  let currentElement = isHTMLElement(node) ? node : node.parentElement;
  while (currentElement && !isBlockElement(currentElement)) {
    yield currentElement;
    currentElement = currentElement.parentElement;
  }
};
