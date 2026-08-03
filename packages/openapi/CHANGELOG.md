# @zemd/openapi

## 0.0.2

### Patch Changes

- Stop a `__proto__` key from replacing the prototype of the object a `Builder` produces.

  `Builder.toJSON()` assigned every collected key onto the result. Assigning `__proto__`
  replaced the prototype of the returned object with a caller controlled value instead of
  adding a property to it, so every lookup made on the result could be redirected. The keys
  are now defined as own data properties, which is what `JSON.parse` produces as well.

## 0.0.1

### Patch Changes

- 39a2f43: alpha release for @zemd/openapi
