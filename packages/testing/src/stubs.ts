import type { TestContext } from "node:test";

type Restore = () => void;

const restoresByContext = new WeakMap<TestContext, Restore[]>();

export function stubEnvironment(
  context: TestContext,
  values: Readonly<Record<string, string | undefined>>,
): () => void {
  const originals = Object.entries(values).map(([key]) => ({
    key,
    existed: Object.hasOwn(process.env, key),
    value: process.env[key],
  }));

  const restore = registerRestore(context, () => {
    for (const original of originals) {
      if (original.existed) {
        process.env[original.key] = original.value;
      } else {
        delete process.env[original.key];
      }
    }
  });

  try {
    for (const [key, value] of Object.entries(values)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  } catch (error) {
    restore();
    throw error;
  }

  return restore;
}

function registerRestore(context: TestContext, restoreValue: () => void): Restore {
  let restores = restoresByContext.get(context);
  if (!restores) {
    restores = [];
    context.after(() => {
      const pendingRestores = restoresByContext.get(context);
      restoresByContext.delete(context);
      while (pendingRestores && pendingRestores.length > 0) {
        pendingRestores.pop()?.();
      }
    });
    restoresByContext.set(context, restores);
  }

  let restored = false;
  const restore = (): void => {
    if (restored) {
      return;
    }
    restored = true;
    restoreValue();
  };
  restores.push(restore);
  return restore;
}
