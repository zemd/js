---
"@zemd/std-modules": patch
---

Prevent prototype pollution by omitting `__proto__`, `constructor`, and `prototype` keys during deep object merges.
