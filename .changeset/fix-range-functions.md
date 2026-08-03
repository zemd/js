---
"@zemd/std-modules": patch
---

Fix two range functions returning values outside their documented range:

- `pingPong()` returned negative results for negative inputs, because the remainder operator
  keeps the sign of the dividend. `pingPong(-1, 2)` returned `-1` instead of `1`.
- `wrap()` returned `Infinity` for finite inputs whose magnitude approached
  `Number.MAX_VALUE`, because reducing by a floored quotient overflows. It now reduces with
  the remainder operator, which cannot overflow, and returns the value unchanged when the
  range is wider than the double range.
