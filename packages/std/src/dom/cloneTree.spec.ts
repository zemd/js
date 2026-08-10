import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { test, type Page } from "playwright/test";

const moduleSource: string = await readFile(new URL("../../dist/dom.mjs", import.meta.url), "utf8");

type ClonePart = "before" | "after";

const cloneAroundStrongText = async (
  page: Page,
  html: string,
  withText: string,
  part: ClonePart,
): Promise<string> => {
  await page.setContent(`<main id="container">${html}</main>`);

  return page.evaluate(
    async ({ source, replacement, selectedPart }) => {
      const moduleUrl = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
      try {
        const dom = (await import(moduleUrl)) as {
          experimental_cloneTree(
            container: Node,
            node: Text,
            withText: Text,
            part: ClonePart,
          ): DocumentFragment;
        };
        const container = document.querySelector("#container");
        const selectedNode = container?.querySelector("strong")?.firstChild;
        if (!(container instanceof HTMLElement) || !(selectedNode instanceof Text)) {
          throw new TypeError("browser fixture did not contain the expected strong text node");
        }

        const fragment = dom.experimental_cloneTree(
          container,
          selectedNode,
          document.createTextNode(replacement),
          selectedPart,
        );
        const wrapper = document.createElement("div");
        wrapper.append(fragment.cloneNode(true));
        return wrapper.innerHTML;
      } finally {
        URL.revokeObjectURL(moduleUrl);
      }
    },
    { source: moduleSource, replacement: withText, selectedPart: part },
  );
};

test.describe("experimental_cloneTree", () => {
  test("creates the structure before a nested text node", async ({ page }) => {
    assert.strictEqual(
      await cloneAroundStrongText(page, "<strong>Hello</strong> World", "Hello", "before"),
      "<strong>Hello</strong>",
    );
  });

  test("creates the structure after a nested text node", async ({ page }) => {
    assert.strictEqual(
      await cloneAroundStrongText(page, "<strong>Hello</strong> World", "", "after"),
      " World",
    );
  });

  test("preserves siblings on the selected side of the boundary", async ({ page }) => {
    assert.strictEqual(
      await cloneAroundStrongText(
        page,
        "Before <strong>selected</strong><em> after</em>",
        "selected",
        "before",
      ),
      "Before <strong>selected</strong>",
    );
    assert.strictEqual(
      await cloneAroundStrongText(
        page,
        "Before <strong>selected</strong><em> after</em>",
        "",
        "after",
      ),
      "<em> after</em>",
    );
  });
});
