/**
 * The `@zemd/std-modules/objects` surface under contract. It is declared structurally rather
 * than imported so that this package stays dependency free and the workspace graph acyclic.
 */
export type TObjectsModule = {
  get: (object: Record<PropertyKey, any>, path: string) => unknown;
  merge: (...inputs: (Record<string, any> | null | undefined)[]) => Record<string, any>;
};

const PROTOTYPES: object[] = [Object.prototype, Array.prototype, Function.prototype];

const PRISTINE_PROTOTYPE_KEYS: Set<string>[] = PROTOTYPES.map((proto) => {
  return new Set(Object.getOwnPropertyNames(proto));
});

/**
 * Reports keys the code under test leaked onto a built-in prototype, and removes them so
 * that a single finding does not cascade into every later check.
 */
export const checkPrototypesIntact = (context: string): string[] => {
  const violations: string[] = [];

  for (const [index, proto] of PROTOTYPES.entries()) {
    const pristine = PRISTINE_PROTOTYPE_KEYS[index];
    for (const key of Object.getOwnPropertyNames(proto)) {
      if (!pristine?.has(key)) {
        delete (proto as Record<string, unknown>)[key];
        violations.push(`${context} added "${key}" to a built-in prototype`);
      }
    }
  }

  return violations;
};

/**
 * The traversal `get` is expected to perform: own properties only. Reaching an inherited
 * property would let a path such as `constructor.prototype` hand out a built-in object.
 */
const traverseOwn = (root: unknown, segments: string[]): unknown => {
  let current: unknown = root;

  for (const segment of segments) {
    if (current === null || current === undefined) {
      return null;
    }
    if (!Object.hasOwn(Object(current) as object, segment)) {
      return null;
    }
    current = (current as Record<string, unknown>)[segment];
  }

  return current ?? null;
};

/**
 * Invariants of `get` for an arbitrary object and an arbitrary dotted path.
 */
export const checkGetInvariants = (
  objects: TObjectsModule,
  object: Record<string, unknown>,
  path: string,
): string[] => {
  const violations: string[] = [];
  const result = objects.get(object, path);

  if (result === undefined) {
    violations.push(`get(object, ${JSON.stringify(path)}) returned undefined instead of null`);
  }

  const expected = traverseOwn(object, path.split("."));
  if (!Object.is(result, expected)) {
    violations.push(
      `get(object, ${JSON.stringify(path)}) returned a value reached outside the own properties`,
    );
  }

  violations.push(...checkPrototypesIntact("objects.get"));

  return violations;
};

const collectReferences = (value: unknown, seen: Set<object>, depth = 0): Set<object> => {
  if (depth > 8 || typeof value !== "object" || value === null || seen.has(value)) {
    return seen;
  }
  seen.add(value);

  for (const nested of Object.values(value)) {
    collectReferences(nested, seen, depth + 1);
  }

  return seen;
};

/**
 * Invariants of `merge` for an arbitrary list of inputs.
 */
export const checkMergeInvariants = (
  objects: TObjectsModule,
  inputs: (Record<string, unknown> | null | undefined)[],
): string[] => {
  const violations: string[] = [];
  const result = objects.merge(...inputs);

  if (Object.getPrototypeOf(result) !== Object.prototype) {
    violations.push("merge() returned an object whose prototype was replaced by its input");
  }

  const inputReferences = new Set<object>();
  for (const input of inputs) {
    collectReferences(input, inputReferences);
  }
  for (const reference of collectReferences(result, new Set<object>())) {
    if (reference !== result && inputReferences.has(reference)) {
      violations.push("merge() returned an object sharing a reference with its input");
      break;
    }
  }

  violations.push(...checkPrototypesIntact("objects.merge"));

  return violations;
};
