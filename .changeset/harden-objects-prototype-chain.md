---
"@zemd/std-modules": minor
---

Stop `objects.get()` and `objects.merge()` from reaching into the prototype chain.

- `get()` now traverses own properties only and returns `null` as soon as a segment is not an
  own property. A path such as `constructor.prototype` previously returned the built-in
  object itself, which is a ready-made gadget for a prototype pollution chain.
- `merge()` now skips an own `__proto__` key instead of assigning it. Assigning it replaced
  the prototype of the returned object with an attacker controlled value, so every lookup
  made on the result could be redirected. Inherited enumerable properties of an input are no
  longer copied either.

Both are behavioural changes for code that relied on reading inherited properties, for
example `get(obj, "someMap.size")` or `merge(classInstance)`.
