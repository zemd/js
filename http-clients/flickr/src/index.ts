import * as photosets from "./api/photosets.ts";
import * as activity from "./api/activity.ts";
import { Debug, Fetcher, UrlTransformer, type HttpClient } from "@zemd/http-client";

type TEndpointFactory<Args extends unknown[]> = (...args: Args) => {
  url: string;
  transformers: HttpClient.Transformer[];
};

export const flickr = (apiKey: string, opts?: { url?: string; debug?: boolean }) => {
  const transformers: HttpClient.Transformer[] = [
    UrlTransformer.prependPath(opts?.url ?? "https://api.flickr.com/services/rest"),
    UrlTransformer.appendQuery({ api_key: apiKey, format: "json", nojsoncallback: 1 }),
  ];
  if (opts?.debug) {
    transformers.push(Debug.make());
  }
  const fetcher = Fetcher.make(transformers);

  const build = <Args extends unknown[]>(factory: TEndpointFactory<Args>) => {
    return async <ResultType = unknown>(...args: Args): Promise<ResultType> => {
      const { url, transformers: endpointTransformers } = factory(...args);
      return fetcher<ResultType>(url, endpointTransformers);
    };
  };

  return {
    photosets: {
      getPhotos: build(photosets.getPhotos),
      addPhoto: build(photosets.addPhoto),
      create: build(photosets.createPhotoset),
      delete: build(photosets.deletePhotoset),
      editMeta: build(photosets.editMeta),
      editPhotos: build(photosets.editPhotos),
      getContext: build(photosets.getContext),
      getInfo: build(photosets.getInfo),
      getList: build(photosets.getList),
      orderSets: build(photosets.orderSets),
      removePhoto: build(photosets.removePhoto),
      removePhotos: build(photosets.removePhotos),
      reorderPhotos: build(photosets.reorderPhotos),
      setPrimaryPhoto: build(photosets.setPrimaryPhoto),
    },
    activity: {
      userComments: build(activity.userComments),
      userPhotos: build(activity.userPhotos),
    },
  };
};
