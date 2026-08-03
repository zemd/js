type GetFieldTypeOfNarrowedByKey<ArgObject, ArgKey> = ArgKey extends keyof ArgObject
  ? ArgObject[ArgKey] extends undefined
    ? null
    : ArgObject[ArgKey]
  : null;

type GetFieldType<ArgObject, ArgPath> = ArgPath extends `${infer Left}.${infer Right}`
  ? GetFieldType<GetFieldTypeOfNarrowedByKey<ArgObject, Left>, Right>
  : GetFieldTypeOfNarrowedByKey<ArgObject, ArgPath>;

export function get<ArgObject extends Record<PropertyKey, any>, ArgPath extends string>(
  obj: ArgObject,
  path: ArgPath,
): GetFieldType<ArgObject, ArgPath> {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition,sonarjs/different-types-comparison
  if (obj === null || typeof obj !== "object") {
    throw new TypeError("To extract value you have to provide object.", {
      cause: { received: obj },
    });
  }
  const keys: string[] = Array.isArray(path) ? path : path.split(".");
  let result: any = obj;

  for (const key of keys) {
    if (result === null || result === undefined) {
      break;
    }
    // Own properties only: reaching the prototype chain would turn a path such as
    // `constructor.prototype` into a handle on a built-in object.
    if (!Object.hasOwn(Object(result) as object, key)) {
      return null as GetFieldType<ArgObject, ArgPath>;
    }
    result = result[key];
  }

  return result ?? null;
}
