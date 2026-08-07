---
"@zemd/gha": major
---

Publish the CI, CodeQL, Scorecard and release pipelines as reusable `shared-*.yml` workflows that other monorepos call by pinned SHA, and move the release tooling into this typed, tested package whose bundle is committed to `.github/scripts`.
