# @zemd/std-modules

## 0.1.0

### Minor Changes

- Stop `objects.get()` and `objects.merge()` from reaching into the prototype chain.

  - `get()` now traverses own properties only and returns `null` as soon as a segment is not an
    own property. A path such as `constructor.prototype` previously returned the built-in
    object itself, which is a ready-made gadget for a prototype pollution chain.
  - `merge()` now skips an own `__proto__` key instead of assigning it. Assigning it replaced
    the prototype of the returned object with an attacker controlled value, so every lookup
    made on the result could be redirected. Inherited enumerable properties of an input are no
    longer copied either.

  Both are behavioural changes for code that relied on reading inherited properties, for
  example `get(obj, "someMap.size")` or `merge(classInstance)`.

### Patch Changes

- Fix two range functions returning values outside their documented range:

  - `pingPong()` returned negative results for negative inputs, because the remainder operator
    keeps the sign of the dividend. `pingPong(-1, 2)` returned `-1` instead of `1`.
  - `wrap()` returned `Infinity` for finite inputs whose magnitude approached
    `Number.MAX_VALUE`, because reducing by a floored quotient overflows. It now reduces with
    the remainder operator, which cannot overflow, and returns the value unchanged when the
    range is wider than the double range.

## 0.0.4

### Patch Changes

- d622eb7: math: add gcd function, refactoring math module

## 0.0.3

### Patch Changes

- 0aee6e4: add std math extentions

## 0.0.2

### Patch Changes

- 8aaed9c: Add promises module
- 8aaed9c: Add http error builders
- 8aaed9c: Add Objects.get function

## 0.0.1

### Patch Changes

- 967b45a: initial version
