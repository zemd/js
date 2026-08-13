# Figma REST API client

A lightweight (4kB only not compressed) fetch-based and type-safe Figma Rest API client.

The package also re-distributes Figma OpenAPI declaration file in JSON format, since original `@figma/rest-api-spec` provides it only in YAML, which requires adding additional dependency.

The client is built using `@zemd/http-client` library, which is very simple `fetch` configurator.

## Installation

```sh
npm install @zemd/figma-rest-api
pnpm add @zemd/figma-rest-api
```

## Usage

```ts
import { figma, figmaToken } from "@zemd/figma-rest-api";

const client = figma([figmaToken("your-figma-token")]);
const response = await client.v1.files.getFile("filekey");
console.log(response);
```

Path identifiers are treated as raw single segments. Values containing delimiters, dot
segments, control characters, or pre-encoded `%` sequences are rejected before a request is
sent. `figmaToken()` also refuses to attach a credential to any origin other than
`https://api.figma.com`.

## License

`@zemd/figma-rest-api` released under the Apache 2.0 license

## Donate

[![](https://img.shields.io/static/v1?label=UNITED24&message=support%20Ukraine&color=blue)](https://u24.gov.ua/)
