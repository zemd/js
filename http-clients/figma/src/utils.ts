import { RequestTransformer, type HttpClient } from "@zemd/http-client";

const FIGMA_ORIGIN = "https://api.figma.com";

export const figmaToken = (value: string): HttpClient.Transformer => {
  const authenticated = RequestTransformer.appendHeader("X-Figma-Token", value);
  return async (fetchFn, ...params) => {
    const input = params[0];
    const url = new URL(input instanceof Request ? input.url : input.toString());
    if (url.origin !== FIGMA_ORIGIN) {
      throw new TypeError(`Refusing to send a Figma token to ${url.origin}.`);
    }
    return authenticated(fetchFn, ...params);
  };
};
