import { header, type TFetchTransformer } from "@zemd/http-client";

const FIGMA_ORIGIN = "https://api.figma.com";

export const figmaToken = (value: string): TFetchTransformer => {
  const authenticated = header("X-Figma-Token", value);
  return async (fetchFn, ...params) => {
    const input = params[0];
    const url = new URL(input instanceof Request ? input.url : input.toString());
    if (url.origin !== FIGMA_ORIGIN) {
      throw new TypeError(`Refusing to send a Figma token to ${url.origin}.`);
    }
    return authenticated(fetchFn, ...params);
  };
};
