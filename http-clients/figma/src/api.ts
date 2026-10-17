import type {
  DeleteCommentPathParams,
  DeleteCommentReactionPathParams,
  DeleteCommentReactionQueryParams,
  DeleteCommentReactionResponse,
  DeleteCommentResponse,
  DeleteDevResourcePathParams,
  DeleteDevResourceResponse,
  DeleteWebhookPathParams,
  DeleteWebhookResponse,
  GetActivityLogsQueryParams,
  GetActivityLogsResponse,
  GetAiUsageDailyQueryParams,
  GetAiUsageDailyResponse,
  GetCommentReactionsPathParams,
  GetCommentReactionsQueryParams,
  GetCommentReactionsResponse,
  GetCommentsPathParams,
  GetCommentsQueryParams,
  GetCommentsResponse,
  GetComponentPathParams,
  GetComponentResponse,
  GetComponentSetPathParams,
  GetComponentSetResponse,
  GetDeveloperLogsRequestBody,
  GetDevResourcesPathParams,
  GetDevResourcesQueryParams,
  GetDevResourcesResponse,
  GetFileComponentSetsPathParams,
  GetFileComponentSetsResponse,
  GetFileComponentsPathParams,
  GetFileComponentsResponse,
  GetFileMetaPathParams,
  GetFileMetaResponse,
  GetFileNodesPathParams,
  GetFileNodesQueryParams,
  GetFileNodesResponse,
  GetFilePathParams,
  GetFileQueryParams,
  GetFileResponse,
  GetFileStylesPathParams,
  GetFileStylesResponse,
  GetFileVersionsPathParams,
  GetFileVersionsQueryParams,
  GetFileVersionsResponse,
  GetFolderFilesPathParams,
  GetFolderFilesQueryParams,
  GetFolderFilesResponse,
  GetFolderFoldersPathParams,
  GetFolderFoldersResponse,
  GetFolderMetaPathParams,
  GetFolderMetaResponse,
  GetImageFillsPathParams,
  GetImageFillsResponse,
  GetImagesPathParams,
  GetImagesQueryParams,
  GetImagesResponse,
  GetLibraryAnalyticsComponentActionsPathParams,
  GetLibraryAnalyticsComponentActionsQueryParams,
  GetLibraryAnalyticsComponentActionsResponse,
  GetLibraryAnalyticsComponentUsagesPathParams,
  GetLibraryAnalyticsComponentUsagesQueryParams,
  GetLibraryAnalyticsComponentUsagesResponse,
  GetLibraryAnalyticsStyleActionsPathParams,
  GetLibraryAnalyticsStyleActionsQueryParams,
  GetLibraryAnalyticsStyleActionsResponse,
  GetLibraryAnalyticsStyleUsagesPathParams,
  GetLibraryAnalyticsStyleUsagesQueryParams,
  GetLibraryAnalyticsStyleUsagesResponse,
  GetLibraryAnalyticsVariableActionsPathParams,
  GetLibraryAnalyticsVariableActionsQueryParams,
  GetLibraryAnalyticsVariableActionsResponse,
  GetLibraryAnalyticsVariableUsagesPathParams,
  GetLibraryAnalyticsVariableUsagesQueryParams,
  GetLibraryAnalyticsVariableUsagesResponse,
  GetLocalVariablesPathParams,
  GetLocalVariablesResponse,
  GetMeResponse,
  GetOEmbedQueryParams,
  GetOEmbedResponse,
  GetPaymentsQueryParams,
  GetPaymentsResponse,
  GetProjectFilesPathParams,
  GetProjectFilesQueryParams,
  GetProjectFilesResponse,
  GetProjectMetaPathParams,
  GetProjectMetaResponse,
  GetPublishedVariablesPathParams,
  GetPublishedVariablesResponse,
  GetStylePathParams,
  GetStyleResponse,
  GetTeamComponentSetsPathParams,
  GetTeamComponentSetsQueryParams,
  GetTeamComponentSetsResponse,
  GetTeamComponentsPathParams,
  GetTeamComponentsQueryParams,
  GetTeamComponentsResponse,
  GetTeamFoldersPathParams,
  GetTeamFoldersResponse,
  GetTeamProjectsPathParams,
  GetTeamProjectsResponse,
  GetTeamStylesPathParams,
  GetTeamStylesQueryParams,
  GetTeamStylesResponse,
  GetTeamWebhooksPathParams,
  GetTeamWebhooksResponse,
  GetWebhookPathParams,
  GetWebhookRequestsPathParams,
  GetWebhookRequestsResponse,
  GetWebhookResponse,
  GetWebhooksQueryParams,
  GetWebhooksResponse,
  PostCommentPathParams,
  PostCommentReactionPathParams,
  PostCommentReactionRequestBody,
  PostCommentReactionResponse,
  PostCommentRequestBody,
  PostCommentResponse,
  PostDeveloperLogsResponse,
  PostDevResourcesRequestBody,
  PostDevResourcesResponse,
  PostVariablesPathParams,
  PostVariablesRequestBody,
  PostVariablesResponse,
  PostWebhookRequestBody,
  PostWebhookResponse,
  PutDevResourcesRequestBody,
  PutDevResourcesResponse,
  PutWebhookPathParams,
  PutWebhookRequestBody,
  PutWebhookResponse,
} from "@figma/rest-api-spec";
import type { HttpClient } from "@zemd/http-client";
import { Fetcher, RequestTransformer, UrlTransformer } from "@zemd/http-client";

export const figma = (initialTransformers: HttpClient.Transformer[]) => {
  const fetcher = Fetcher.make([
    UrlTransformer.prependPath("https://api.figma.com"),
    RequestTransformer.jsonContentType(),
    ...initialTransformers,
  ]);
  return {
    v1: {
      files: {
        getFile: async (fileKey: GetFilePathParams["file_key"], options?: GetFileQueryParams) => {
          const transformers = [RequestTransformer.setMethod("GET")];
          if (options) {
            transformers.push(UrlTransformer.appendQuery(options));
          }
          return fetcher<GetFileResponse>(
            `/v1/files/${UrlTransformer.encodePathSegment(fileKey)}`,
            transformers,
          );
        },
        getFileNodes: async (
          fileKey: GetFileNodesPathParams["file_key"],
          options: GetFileNodesQueryParams,
        ) => {
          return fetcher<GetFileNodesResponse>(
            `/v1/files/${UrlTransformer.encodePathSegment(fileKey)}/nodes`,
            [RequestTransformer.setMethod("GET"), UrlTransformer.appendQuery(options)],
          );
        },
        getImageFills: async (fileKey: GetImageFillsPathParams["file_key"]) => {
          return fetcher<GetImageFillsResponse>(
            `/v1/files/${UrlTransformer.encodePathSegment(fileKey)}/images`,
            [RequestTransformer.setMethod("GET")],
          );
        },
        getFileMeta: async (fileKey: GetFileMetaPathParams["file_key"]) => {
          return fetcher<GetFileMetaResponse>(
            `/v1/files/${UrlTransformer.encodePathSegment(fileKey)}/meta`,
            [RequestTransformer.setMethod("GET")],
          );
        },
        getFileVersions: async (
          fileKey: GetFileVersionsPathParams["file_key"],
          options?: GetFileVersionsQueryParams,
        ) => {
          const transformers = [RequestTransformer.setMethod("GET")];
          if (options) {
            transformers.push(UrlTransformer.appendQuery(options));
          }
          return fetcher<GetFileVersionsResponse>(
            `/v1/files/${UrlTransformer.encodePathSegment(fileKey)}/versions`,
            transformers,
          );
        },
        getComments: async (
          fileKey: GetCommentsPathParams["file_key"],
          options?: GetCommentsQueryParams,
        ) => {
          const transformers = [RequestTransformer.setMethod("GET")];
          if (options) {
            transformers.push(UrlTransformer.appendQuery(options));
          }
          return fetcher<GetCommentsResponse>(
            `/v1/files/${UrlTransformer.encodePathSegment(fileKey)}/comments`,
            transformers,
          );
        },
        postComment: async (
          fileKey: PostCommentPathParams["file_key"],
          obj: PostCommentRequestBody,
        ) => {
          return fetcher<PostCommentResponse>(
            `/v1/files/${UrlTransformer.encodePathSegment(fileKey)}/comments`,
            [RequestTransformer.setMethod("POST"), RequestTransformer.setBody(JSON.stringify(obj))],
          );
        },
        deleteComment: async (
          fileKey: DeleteCommentPathParams["file_key"],
          commentId: DeleteCommentPathParams["comment_id"],
        ) => {
          return fetcher<DeleteCommentResponse>(
            `/v1/files/${UrlTransformer.encodePathSegment(fileKey)}/comments/${UrlTransformer.encodePathSegment(commentId)}`,
            [RequestTransformer.setMethod("DELETE")],
          );
        },
        getCommentReactions: async (
          fileKey: GetCommentReactionsPathParams["file_key"],
          commentId: GetCommentReactionsPathParams["comment_id"],
          options?: GetCommentReactionsQueryParams,
        ) => {
          const transformers = [RequestTransformer.setMethod("GET")];
          if (options) {
            transformers.push(UrlTransformer.appendQuery(options));
          }
          return fetcher<GetCommentReactionsResponse>(
            `/v1/files/${UrlTransformer.encodePathSegment(fileKey)}/comments/${UrlTransformer.encodePathSegment(commentId)}/reactions`,
            transformers,
          );
        },
        postCommentReaction: async (
          fileKey: PostCommentReactionPathParams["file_key"],
          commentId: PostCommentReactionPathParams["comment_id"],
          obj: PostCommentReactionRequestBody,
        ) => {
          return fetcher<PostCommentReactionResponse>(
            `/v1/files/${UrlTransformer.encodePathSegment(fileKey)}/comments/${UrlTransformer.encodePathSegment(commentId)}/reactions`,
            [RequestTransformer.setMethod("POST"), RequestTransformer.setBody(JSON.stringify(obj))],
          );
        },
        deleteCommentReaction: async (
          fileKey: DeleteCommentReactionPathParams["file_key"],
          commentId: DeleteCommentReactionPathParams["comment_id"],
          options: DeleteCommentReactionQueryParams,
        ) => {
          return fetcher<DeleteCommentReactionResponse>(
            `/v1/files/${UrlTransformer.encodePathSegment(fileKey)}/comments/${UrlTransformer.encodePathSegment(commentId)}/reactions`,
            [RequestTransformer.setMethod("DELETE"), UrlTransformer.appendQuery(options)],
          );
        },
        getFileComponents: async (fileKey: GetFileComponentsPathParams["file_key"]) => {
          return fetcher<GetFileComponentsResponse>(
            `/v1/files/${UrlTransformer.encodePathSegment(fileKey)}/components`,
            [RequestTransformer.setMethod("GET")],
          );
        },
        getFileComponentSets: async (fileKey: GetFileComponentSetsPathParams["file_key"]) => {
          return fetcher<GetFileComponentSetsResponse>(
            `/v1/files/${UrlTransformer.encodePathSegment(fileKey)}/component_sets`,
            [RequestTransformer.setMethod("GET")],
          );
        },
        getFileStyles: async (fileKey: GetFileStylesPathParams["file_key"]) => {
          return fetcher<GetFileStylesResponse>(
            `/v1/files/${UrlTransformer.encodePathSegment(fileKey)}/styles`,
            [RequestTransformer.setMethod("GET")],
          );
        },
        getLocalVariables: async (fileKey: GetLocalVariablesPathParams["file_key"]) => {
          return fetcher<GetLocalVariablesResponse>(
            `/v1/files/${UrlTransformer.encodePathSegment(fileKey)}/variables/local`,
            [RequestTransformer.setMethod("GET")],
          );
        },
        getPublishedVariables: async (fileKey: GetPublishedVariablesPathParams["file_key"]) => {
          return fetcher<GetPublishedVariablesResponse>(
            `/v1/files/${UrlTransformer.encodePathSegment(fileKey)}/variables/published`,
            [RequestTransformer.setMethod("GET")],
          );
        },
        postVariables: async (
          fileKey: PostVariablesPathParams["file_key"],
          obj: PostVariablesRequestBody,
        ) => {
          return fetcher<PostVariablesResponse>(
            `/v1/files/${UrlTransformer.encodePathSegment(fileKey)}/variables`,
            [RequestTransformer.setMethod("POST"), RequestTransformer.setBody(JSON.stringify(obj))],
          );
        },
        getDevResources: async (
          fileKey: GetDevResourcesPathParams["file_key"],
          options?: GetDevResourcesQueryParams,
        ) => {
          const transformers = [RequestTransformer.setMethod("GET")];
          if (options) {
            transformers.push(UrlTransformer.appendQuery(options));
          }
          return fetcher<GetDevResourcesResponse>(
            `/v1/files/${UrlTransformer.encodePathSegment(fileKey)}/dev_resources`,
            transformers,
          );
        },
        deleteDevResource: async (
          fileKey: DeleteDevResourcePathParams["file_key"],
          devResourceId: DeleteDevResourcePathParams["dev_resource_id"],
        ) => {
          return fetcher<DeleteDevResourceResponse>(
            `/v1/files/${UrlTransformer.encodePathSegment(fileKey)}/dev_resources/${UrlTransformer.encodePathSegment(devResourceId)}`,
            [RequestTransformer.setMethod("DELETE")],
          );
        },
      },
      images: {
        getImages: async (
          fileKey: GetImagesPathParams["file_key"],
          options: GetImagesQueryParams,
        ) => {
          return fetcher<GetImagesResponse>(
            `/v1/images/${UrlTransformer.encodePathSegment(fileKey)}`,
            [RequestTransformer.setMethod("GET"), UrlTransformer.appendQuery(options)],
          );
        },
      },
      teams: {
        getTeamProjects: async (teamId: GetTeamProjectsPathParams["team_id"]) => {
          return fetcher<GetTeamProjectsResponse>(
            `/v1/teams/${UrlTransformer.encodePathSegment(teamId)}/projects`,
            [RequestTransformer.setMethod("GET")],
          );
        },
        getTeamComponents: async (
          teamId: GetTeamComponentsPathParams["team_id"],
          options?: GetTeamComponentsQueryParams,
        ) => {
          const transformers = [RequestTransformer.setMethod("GET")];
          if (options) {
            transformers.push(UrlTransformer.appendQuery(options));
          }
          return fetcher<GetTeamComponentsResponse>(
            `/v1/teams/${UrlTransformer.encodePathSegment(teamId)}/components`,
            transformers,
          );
        },
        getTeamComponentSets: async (
          teamId: GetTeamComponentSetsPathParams["team_id"],
          options?: GetTeamComponentSetsQueryParams,
        ) => {
          const transformers = [RequestTransformer.setMethod("GET")];
          if (options) {
            transformers.push(UrlTransformer.appendQuery(options));
          }
          return fetcher<GetTeamComponentSetsResponse>(
            `/v1/teams/${UrlTransformer.encodePathSegment(teamId)}/component_sets`,
            transformers,
          );
        },
        getTeamStyles: async (
          teamId: GetTeamStylesPathParams["team_id"],
          options?: GetTeamStylesQueryParams,
        ) => {
          const transformers = [RequestTransformer.setMethod("GET")];
          if (options) {
            transformers.push(UrlTransformer.appendQuery(options));
          }
          return fetcher<GetTeamStylesResponse>(
            `/v1/teams/${UrlTransformer.encodePathSegment(teamId)}/styles`,
            transformers,
          );
        },
      },
      projects: {
        getProjectMeta: async (projectId: GetProjectMetaPathParams["project_id"]) => {
          return fetcher<GetProjectMetaResponse>(
            `/v1/projects/${UrlTransformer.encodePathSegment(projectId)}/meta`,
            [RequestTransformer.setMethod("GET")],
          );
        },
        getProjectFiles: async (
          projectId: GetProjectFilesPathParams["project_id"],
          options?: GetProjectFilesQueryParams,
        ) => {
          const transformers = [RequestTransformer.setMethod("GET")];
          if (options) {
            transformers.push(UrlTransformer.appendQuery(options));
          }
          return fetcher<GetProjectFilesResponse>(
            `/v1/projects/${UrlTransformer.encodePathSegment(projectId)}/files`,
            transformers,
          );
        },
      },
      me: {
        getMe: async () => {
          return fetcher<GetMeResponse>(`/v1/me`, [RequestTransformer.setMethod("GET")]);
        },
      },
      components: {
        getComponent: async (key: GetComponentPathParams["key"]) => {
          return fetcher<GetComponentResponse>(
            `/v1/components/${UrlTransformer.encodePathSegment(key)}`,
            [RequestTransformer.setMethod("GET")],
          );
        },
      },
      component_sets: {
        getComponentSet: async (key: GetComponentSetPathParams["key"]) => {
          return fetcher<GetComponentSetResponse>(
            `/v1/component_sets/${UrlTransformer.encodePathSegment(key)}`,
            [RequestTransformer.setMethod("GET")],
          );
        },
      },
      styles: {
        getStyle: async (key: GetStylePathParams["key"]) => {
          return fetcher<GetStyleResponse>(`/v1/styles/${UrlTransformer.encodePathSegment(key)}`, [
            RequestTransformer.setMethod("GET"),
          ]);
        },
      },
      activity_logs: {
        getActivityLogs: async (options?: GetActivityLogsQueryParams) => {
          const transformers = [RequestTransformer.setMethod("GET")];
          if (options) {
            transformers.push(UrlTransformer.appendQuery(options));
          }
          return fetcher<GetActivityLogsResponse>(`/v1/activity_logs`, transformers);
        },
      },
      developer_logs: {
        getDeveloperLogs: async (obj: GetDeveloperLogsRequestBody) => {
          return fetcher<PostDeveloperLogsResponse>(`/v1/developer_logs`, [
            RequestTransformer.setMethod("POST"),
            RequestTransformer.setBody(JSON.stringify(obj)),
          ]);
        },
      },
      ai_usage: {
        getAiUsageDaily: async (options: GetAiUsageDailyQueryParams) => {
          return fetcher<GetAiUsageDailyResponse>(`/v1/ai_usage/daily`, [
            RequestTransformer.setMethod("GET"),
            UrlTransformer.appendQuery(options),
          ]);
        },
      },
      payments: {
        getPayments: async (options?: GetPaymentsQueryParams) => {
          const transformers = [RequestTransformer.setMethod("GET")];
          if (options) {
            transformers.push(UrlTransformer.appendQuery(options));
          }
          return fetcher<GetPaymentsResponse>(`/v1/payments`, transformers);
        },
      },
      dev_resources: {
        postDevResources: async (obj: PostDevResourcesRequestBody) => {
          return fetcher<PostDevResourcesResponse>(`/v1/dev_resources`, [
            RequestTransformer.setMethod("POST"),
            RequestTransformer.setBody(JSON.stringify(obj)),
          ]);
        },
        putDevResources: async (obj: PutDevResourcesRequestBody) => {
          return fetcher<PutDevResourcesResponse>(`/v1/dev_resources`, [
            RequestTransformer.setMethod("PUT"),
            RequestTransformer.setBody(JSON.stringify(obj)),
          ]);
        },
      },
      analytics: {
        getLibraryAnalyticsComponentActions: async (
          fileKey: GetLibraryAnalyticsComponentActionsPathParams["file_key"],
          options: GetLibraryAnalyticsComponentActionsQueryParams,
        ) => {
          return fetcher<GetLibraryAnalyticsComponentActionsResponse>(
            `/v1/analytics/libraries/${UrlTransformer.encodePathSegment(fileKey)}/component/actions`,
            [RequestTransformer.setMethod("GET"), UrlTransformer.appendQuery(options)],
          );
        },
        getLibraryAnalyticsComponentUsages: async (
          fileKey: GetLibraryAnalyticsComponentUsagesPathParams["file_key"],
          options: GetLibraryAnalyticsComponentUsagesQueryParams,
        ) => {
          return fetcher<GetLibraryAnalyticsComponentUsagesResponse>(
            `/v1/analytics/libraries/${UrlTransformer.encodePathSegment(fileKey)}/component/usages`,
            [RequestTransformer.setMethod("GET"), UrlTransformer.appendQuery(options)],
          );
        },
        getLibraryAnalyticsStyleActions: async (
          fileKey: GetLibraryAnalyticsStyleActionsPathParams["file_key"],
          options: GetLibraryAnalyticsStyleActionsQueryParams,
        ) => {
          return fetcher<GetLibraryAnalyticsStyleActionsResponse>(
            `/v1/analytics/libraries/${UrlTransformer.encodePathSegment(fileKey)}/style/actions`,
            [RequestTransformer.setMethod("GET"), UrlTransformer.appendQuery(options)],
          );
        },
        getLibraryAnalyticsStyleUsages: async (
          fileKey: GetLibraryAnalyticsStyleUsagesPathParams["file_key"],
          options: GetLibraryAnalyticsStyleUsagesQueryParams,
        ) => {
          return fetcher<GetLibraryAnalyticsStyleUsagesResponse>(
            `/v1/analytics/libraries/${UrlTransformer.encodePathSegment(fileKey)}/style/usages`,
            [RequestTransformer.setMethod("GET"), UrlTransformer.appendQuery(options)],
          );
        },
        getLibraryAnalyticsVariableActions: async (
          fileKey: GetLibraryAnalyticsVariableActionsPathParams["file_key"],
          options: GetLibraryAnalyticsVariableActionsQueryParams,
        ) => {
          return fetcher<GetLibraryAnalyticsVariableActionsResponse>(
            `/v1/analytics/libraries/${UrlTransformer.encodePathSegment(fileKey)}/variable/actions`,
            [RequestTransformer.setMethod("GET"), UrlTransformer.appendQuery(options)],
          );
        },
        getLibraryAnalyticsVariableUsages: async (
          fileKey: GetLibraryAnalyticsVariableUsagesPathParams["file_key"],
          options: GetLibraryAnalyticsVariableUsagesQueryParams,
        ) => {
          return fetcher<GetLibraryAnalyticsVariableUsagesResponse>(
            `/v1/analytics/libraries/${UrlTransformer.encodePathSegment(fileKey)}/variable/usages`,
            [RequestTransformer.setMethod("GET"), UrlTransformer.appendQuery(options)],
          );
        },
      },
      oembed: {
        getOEmbed: async (options: GetOEmbedQueryParams) => {
          return fetcher<GetOEmbedResponse>(`/v1/oembed`, [
            RequestTransformer.setMethod("GET"),
            UrlTransformer.appendQuery(options),
          ]);
        },
      },
    },
    v2: {
      teams: {
        getTeamFolders: async (teamId: GetTeamFoldersPathParams["team_id"]) => {
          return fetcher<GetTeamFoldersResponse>(
            `/v2/teams/${UrlTransformer.encodePathSegment(teamId)}/folders`,
            [RequestTransformer.setMethod("GET")],
          );
        },
        getTeamWebhooks: async (teamId: GetTeamWebhooksPathParams["team_id"]) => {
          return fetcher<GetTeamWebhooksResponse>(
            `/v2/teams/${UrlTransformer.encodePathSegment(teamId)}/webhooks`,
            [RequestTransformer.setMethod("GET")],
          );
        },
      },
      folders: {
        getFolderFolders: async (folderId: GetFolderFoldersPathParams["folder_id"]) => {
          return fetcher<GetFolderFoldersResponse>(
            `/v2/folders/${UrlTransformer.encodePathSegment(folderId)}/folders`,
            [RequestTransformer.setMethod("GET")],
          );
        },
        getFolderFiles: async (
          folderId: GetFolderFilesPathParams["folder_id"],
          options?: GetFolderFilesQueryParams,
        ) => {
          const transformers = [RequestTransformer.setMethod("GET")];
          if (options) {
            transformers.push(UrlTransformer.appendQuery(options));
          }
          return fetcher<GetFolderFilesResponse>(
            `/v2/folders/${UrlTransformer.encodePathSegment(folderId)}/files`,
            transformers,
          );
        },
        getFolderMeta: async (folderId: GetFolderMetaPathParams["folder_id"]) => {
          return fetcher<GetFolderMetaResponse>(
            `/v2/folders/${UrlTransformer.encodePathSegment(folderId)}/meta`,
            [RequestTransformer.setMethod("GET")],
          );
        },
      },
      webhooks: {
        getWebhooks: async (options?: GetWebhooksQueryParams) => {
          const transformers = [RequestTransformer.setMethod("GET")];
          if (options) {
            transformers.push(UrlTransformer.appendQuery(options));
          }
          return fetcher<GetWebhooksResponse>(`/v2/webhooks`, transformers);
        },
        postWebhook: async (obj: PostWebhookRequestBody) => {
          return fetcher<PostWebhookResponse>(`/v2/webhooks`, [
            RequestTransformer.setMethod("POST"),
            RequestTransformer.setBody(JSON.stringify(obj)),
          ]);
        },
        getWebhook: async (webhookId: GetWebhookPathParams["webhook_id"]) => {
          return fetcher<GetWebhookResponse>(
            `/v2/webhooks/${UrlTransformer.encodePathSegment(webhookId)}`,
            [RequestTransformer.setMethod("GET")],
          );
        },
        putWebhook: async (
          webhookId: PutWebhookPathParams["webhook_id"],
          obj: PutWebhookRequestBody,
        ) => {
          return fetcher<PutWebhookResponse>(
            `/v2/webhooks/${UrlTransformer.encodePathSegment(webhookId)}`,
            [RequestTransformer.setMethod("PUT"), RequestTransformer.setBody(JSON.stringify(obj))],
          );
        },
        deleteWebhook: async (webhookId: DeleteWebhookPathParams["webhook_id"]) => {
          return fetcher<DeleteWebhookResponse>(
            `/v2/webhooks/${UrlTransformer.encodePathSegment(webhookId)}`,
            [RequestTransformer.setMethod("DELETE")],
          );
        },
        getWebhookRequests: async (webhookId: GetWebhookRequestsPathParams["webhook_id"]) => {
          return fetcher<GetWebhookRequestsResponse>(
            `/v2/webhooks/${UrlTransformer.encodePathSegment(webhookId)}/requests`,
            [RequestTransformer.setMethod("GET")],
          );
        },
      },
    },
  };
};
