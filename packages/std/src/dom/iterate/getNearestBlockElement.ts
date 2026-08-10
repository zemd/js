import { isBlockElement } from "../check.ts";

export const getNearestBlockElement = (node: Node): HTMLElement | null => {
  let currentElement = node.parentElement;
  while (currentElement && !isBlockElement(currentElement)) {
    currentElement = currentElement.parentElement;
  }
  return currentElement;
};
