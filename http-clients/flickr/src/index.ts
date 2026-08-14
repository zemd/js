import * as photosets from "./api/photosets.ts";
import * as activity from "./api/activity.ts";
import {
  createEndpoint,
  debug as debugTransformer,
  prefix,
  query,
  type TFetchTransformer,
} from "@zemd/http-client";

type TEndpointFactory<Args extends unknown[]> = (...args: Args) => {
  url: string;
  transformers: TFetchTransformer[];
};

export const flickr = (apiKey: string, opts?: { url?: string; debug?: boolean }) => {
  const transformers: TFetchTransformer[] = [
    prefix(opts?.url ?? "https://api.flickr.com/services/rest"),
    query({ api_key: apiKey, format: "json", nojsoncallback: 1 }),
  ];
  if (opts?.debug) {
    transformers.push(debugTransformer());
  }
  const endpoint = createEndpoint(transformers);

  const build = <Args extends unknown[]>(factory: TEndpointFactory<Args>) => {
    return async <ResultType = unknown>(...args: Args): Promise<ResultType> => {
      const { url, transformers: endpointTransformers } = factory(...args);
      return endpoint<ResultType>(url, endpointTransformers);
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
