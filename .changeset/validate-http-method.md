---
"@zemd/http-client": minor
---

`method()` now rejects names that are not valid RFC 9110 tokens, throwing a `TypeError`
instead of forwarding characters such as CR, LF or NUL into `RequestInit.method`. This
closes a request smuggling vector for callers that build the method from untrusted input
and pass the request to a custom `fetch` implementation that does not validate it itself.
