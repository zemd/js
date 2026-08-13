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
import type { TFetchTransformer } from "@zemd/http-client";
import { body, createEndpoint, json, method, pathSegment, prefix, query } from "@zemd/http-client";

export const figma = (initialTransformers: TFetchTransformer[]) => {
  const endpoint = createEndpoint([
    prefix("https://api.figma.com"),
    json(),
    ...initialTransformers,
  ]);
  return {
    v1: {
      files: {
        getFile: async (fileKey: GetFilePathParams["file_key"], options?: GetFileQueryParams) => {
          const transformers = [method("GET")];
          if (options) {
            transformers.push(query(options));
          }
          return endpoint<GetFileResponse>(`/v1/files/${pathSegment(fileKey)}`, transformers);
        },
        getFileNodes: async (
          fileKey: GetFileNodesPathParams["file_key"],
          options: GetFileNodesQueryParams,
        ) => {
          return endpoint<GetFileNodesResponse>(`/v1/files/${pathSegment(fileKey)}/nodes`, [
            method("GET"),
            query(options),
          ]);
        },
        getImageFills: async (fileKey: GetImageFillsPathParams["file_key"]) => {
          return endpoint<GetImageFillsResponse>(`/v1/files/${pathSegment(fileKey)}/images`, [
            method("GET"),
          ]);
        },
        getFileMeta: async (fileKey: GetFileMetaPathParams["file_key"]) => {
          return endpoint<GetFileMetaResponse>(`/v1/files/${pathSegment(fileKey)}/meta`, [
            method("GET"),
          ]);
        },
        getFileVersions: async (
          fileKey: GetFileVersionsPathParams["file_key"],
          options?: GetFileVersionsQueryParams,
        ) => {
          const transformers = [method("GET")];
          if (options) {
            transformers.push(query(options));
          }
          return endpoint<GetFileVersionsResponse>(
            `/v1/files/${pathSegment(fileKey)}/versions`,
            transformers,
          );
        },
        getComments: async (
          fileKey: GetCommentsPathParams["file_key"],
          options?: GetCommentsQueryParams,
        ) => {
          const transformers = [method("GET")];
          if (options) {
            transformers.push(query(options));
          }
          return endpoint<GetCommentsResponse>(
            `/v1/files/${pathSegment(fileKey)}/comments`,
            transformers,
          );
        },
        postComment: async (
          fileKey: PostCommentPathParams["file_key"],
          obj: PostCommentRequestBody,
        ) => {
          return endpoint<PostCommentResponse>(`/v1/files/${pathSegment(fileKey)}/comments`, [
            method("POST"),
            body(JSON.stringify(obj)),
          ]);
        },
        deleteComment: async (
          fileKey: DeleteCommentPathParams["file_key"],
          commentId: DeleteCommentPathParams["comment_id"],
        ) => {
          return endpoint<DeleteCommentResponse>(
            `/v1/files/${pathSegment(fileKey)}/comments/${pathSegment(commentId)}`,
            [method("DELETE")],
          );
        },
        getCommentReactions: async (
          fileKey: GetCommentReactionsPathParams["file_key"],
          commentId: GetCommentReactionsPathParams["comment_id"],
          options?: GetCommentReactionsQueryParams,
        ) => {
          const transformers = [method("GET")];
          if (options) {
            transformers.push(query(options));
          }
          return endpoint<GetCommentReactionsResponse>(
            `/v1/files/${pathSegment(fileKey)}/comments/${pathSegment(commentId)}/reactions`,
            transformers,
          );
        },
        postCommentReaction: async (
          fileKey: PostCommentReactionPathParams["file_key"],
          commentId: PostCommentReactionPathParams["comment_id"],
          obj: PostCommentReactionRequestBody,
        ) => {
          return endpoint<PostCommentReactionResponse>(
            `/v1/files/${pathSegment(fileKey)}/comments/${pathSegment(commentId)}/reactions`,
            [method("POST"), body(JSON.stringify(obj))],
          );
        },
        deleteCommentReaction: async (
          fileKey: DeleteCommentReactionPathParams["file_key"],
          commentId: DeleteCommentReactionPathParams["comment_id"],
          options: DeleteCommentReactionQueryParams,
        ) => {
          return endpoint<DeleteCommentReactionResponse>(
            `/v1/files/${pathSegment(fileKey)}/comments/${pathSegment(commentId)}/reactions`,
            [method("DELETE"), query(options)],
          );
        },
        getFileComponents: async (fileKey: GetFileComponentsPathParams["file_key"]) => {
          return endpoint<GetFileComponentsResponse>(
            `/v1/files/${pathSegment(fileKey)}/components`,
            [method("GET")],
          );
        },
        getFileComponentSets: async (fileKey: GetFileComponentSetsPathParams["file_key"]) => {
          return endpoint<GetFileComponentSetsResponse>(
            `/v1/files/${pathSegment(fileKey)}/component_sets`,
            [method("GET")],
          );
        },
        getFileStyles: async (fileKey: GetFileStylesPathParams["file_key"]) => {
          return endpoint<GetFileStylesResponse>(`/v1/files/${pathSegment(fileKey)}/styles`, [
            method("GET"),
          ]);
        },
        getLocalVariables: async (fileKey: GetLocalVariablesPathParams["file_key"]) => {
          return endpoint<GetLocalVariablesResponse>(
            `/v1/files/${pathSegment(fileKey)}/variables/local`,
            [method("GET")],
          );
        },
        getPublishedVariables: async (fileKey: GetPublishedVariablesPathParams["file_key"]) => {
          return endpoint<GetPublishedVariablesResponse>(
            `/v1/files/${pathSegment(fileKey)}/variables/published`,
            [method("GET")],
          );
        },
        postVariables: async (
          fileKey: PostVariablesPathParams["file_key"],
          obj: PostVariablesRequestBody,
        ) => {
          return endpoint<PostVariablesResponse>(`/v1/files/${pathSegment(fileKey)}/variables`, [
            method("POST"),
            body(JSON.stringify(obj)),
          ]);
        },
        getDevResources: async (
          fileKey: GetDevResourcesPathParams["file_key"],
          options?: GetDevResourcesQueryParams,
        ) => {
          const transformers = [method("GET")];
          if (options) {
            transformers.push(query(options));
          }
          return endpoint<GetDevResourcesResponse>(
            `/v1/files/${pathSegment(fileKey)}/dev_resources`,
            transformers,
          );
        },
        deleteDevResource: async (
          fileKey: DeleteDevResourcePathParams["file_key"],
          devResourceId: DeleteDevResourcePathParams["dev_resource_id"],
        ) => {
          return endpoint<DeleteDevResourceResponse>(
            `/v1/files/${pathSegment(fileKey)}/dev_resources/${pathSegment(devResourceId)}`,
            [method("DELETE")],
          );
        },
      },
      images: {
        getImages: async (
          fileKey: GetImagesPathParams["file_key"],
          options: GetImagesQueryParams,
        ) => {
          return endpoint<GetImagesResponse>(`/v1/images/${pathSegment(fileKey)}`, [
            method("GET"),
            query(options),
          ]);
        },
      },
      teams: {
        getTeamProjects: async (teamId: GetTeamProjectsPathParams["team_id"]) => {
          return endpoint<GetTeamProjectsResponse>(`/v1/teams/${pathSegment(teamId)}/projects`, [
            method("GET"),
          ]);
        },
        getTeamComponents: async (
          teamId: GetTeamComponentsPathParams["team_id"],
          options?: GetTeamComponentsQueryParams,
        ) => {
          const transformers = [method("GET")];
          if (options) {
            transformers.push(query(options));
          }
          return endpoint<GetTeamComponentsResponse>(
            `/v1/teams/${pathSegment(teamId)}/components`,
            transformers,
          );
        },
        getTeamComponentSets: async (
          teamId: GetTeamComponentSetsPathParams["team_id"],
          options?: GetTeamComponentSetsQueryParams,
        ) => {
          const transformers = [method("GET")];
          if (options) {
            transformers.push(query(options));
          }
          return endpoint<GetTeamComponentSetsResponse>(
            `/v1/teams/${pathSegment(teamId)}/component_sets`,
            transformers,
          );
        },
        getTeamStyles: async (
          teamId: GetTeamStylesPathParams["team_id"],
          options?: GetTeamStylesQueryParams,
        ) => {
          const transformers = [method("GET")];
          if (options) {
            transformers.push(query(options));
          }
          return endpoint<GetTeamStylesResponse>(
            `/v1/teams/${pathSegment(teamId)}/styles`,
            transformers,
          );
        },
      },
      projects: {
        getProjectMeta: async (projectId: GetProjectMetaPathParams["project_id"]) => {
          return endpoint<GetProjectMetaResponse>(`/v1/projects/${pathSegment(projectId)}/meta`, [
            method("GET"),
          ]);
        },
        getProjectFiles: async (
          projectId: GetProjectFilesPathParams["project_id"],
          options?: GetProjectFilesQueryParams,
        ) => {
          const transformers = [method("GET")];
          if (options) {
            transformers.push(query(options));
          }
          return endpoint<GetProjectFilesResponse>(
            `/v1/projects/${pathSegment(projectId)}/files`,
            transformers,
          );
        },
      },
      me: {
        getMe: async () => {
          return endpoint<GetMeResponse>(`/v1/me`, [method("GET")]);
        },
      },
      components: {
        getComponent: async (key: GetComponentPathParams["key"]) => {
          return endpoint<GetComponentResponse>(`/v1/components/${pathSegment(key)}`, [
            method("GET"),
          ]);
        },
      },
      component_sets: {
        getComponentSet: async (key: GetComponentSetPathParams["key"]) => {
          return endpoint<GetComponentSetResponse>(`/v1/component_sets/${pathSegment(key)}`, [
            method("GET"),
          ]);
        },
      },
      styles: {
        getStyle: async (key: GetStylePathParams["key"]) => {
          return endpoint<GetStyleResponse>(`/v1/styles/${pathSegment(key)}`, [method("GET")]);
        },
      },
      activity_logs: {
        getActivityLogs: async (options?: GetActivityLogsQueryParams) => {
          const transformers = [method("GET")];
          if (options) {
            transformers.push(query(options));
          }
          return endpoint<GetActivityLogsResponse>(`/v1/activity_logs`, transformers);
        },
      },
      developer_logs: {
        getDeveloperLogs: async (obj: GetDeveloperLogsRequestBody) => {
          return endpoint<PostDeveloperLogsResponse>(`/v1/developer_logs`, [
            method("POST"),
            body(JSON.stringify(obj)),
          ]);
        },
      },
      ai_usage: {
        getAiUsageDaily: async (options: GetAiUsageDailyQueryParams) => {
          return endpoint<GetAiUsageDailyResponse>(`/v1/ai_usage/daily`, [
            method("GET"),
            query(options),
          ]);
        },
      },
      payments: {
        getPayments: async (options?: GetPaymentsQueryParams) => {
          const transformers = [method("GET")];
          if (options) {
            transformers.push(query(options));
          }
          return endpoint<GetPaymentsResponse>(`/v1/payments`, transformers);
        },
      },
      dev_resources: {
        postDevResources: async (obj: PostDevResourcesRequestBody) => {
          return endpoint<PostDevResourcesResponse>(`/v1/dev_resources`, [
            method("POST"),
            body(JSON.stringify(obj)),
          ]);
        },
        putDevResources: async (obj: PutDevResourcesRequestBody) => {
          return endpoint<PutDevResourcesResponse>(`/v1/dev_resources`, [
            method("PUT"),
            body(JSON.stringify(obj)),
          ]);
        },
      },
      analytics: {
        getLibraryAnalyticsComponentActions: async (
          fileKey: GetLibraryAnalyticsComponentActionsPathParams["file_key"],
          options: GetLibraryAnalyticsComponentActionsQueryParams,
        ) => {
          return endpoint<GetLibraryAnalyticsComponentActionsResponse>(
            `/v1/analytics/libraries/${pathSegment(fileKey)}/component/actions`,
            [method("GET"), query(options)],
          );
        },
        getLibraryAnalyticsComponentUsages: async (
          fileKey: GetLibraryAnalyticsComponentUsagesPathParams["file_key"],
          options: GetLibraryAnalyticsComponentUsagesQueryParams,
        ) => {
          return endpoint<GetLibraryAnalyticsComponentUsagesResponse>(
            `/v1/analytics/libraries/${pathSegment(fileKey)}/component/usages`,
            [method("GET"), query(options)],
          );
        },
        getLibraryAnalyticsStyleActions: async (
          fileKey: GetLibraryAnalyticsStyleActionsPathParams["file_key"],
          options: GetLibraryAnalyticsStyleActionsQueryParams,
        ) => {
          return endpoint<GetLibraryAnalyticsStyleActionsResponse>(
            `/v1/analytics/libraries/${pathSegment(fileKey)}/style/actions`,
            [method("GET"), query(options)],
          );
        },
        getLibraryAnalyticsStyleUsages: async (
          fileKey: GetLibraryAnalyticsStyleUsagesPathParams["file_key"],
          options: GetLibraryAnalyticsStyleUsagesQueryParams,
        ) => {
          return endpoint<GetLibraryAnalyticsStyleUsagesResponse>(
            `/v1/analytics/libraries/${pathSegment(fileKey)}/style/usages`,
            [method("GET"), query(options)],
          );
        },
        getLibraryAnalyticsVariableActions: async (
          fileKey: GetLibraryAnalyticsVariableActionsPathParams["file_key"],
          options: GetLibraryAnalyticsVariableActionsQueryParams,
        ) => {
          return endpoint<GetLibraryAnalyticsVariableActionsResponse>(
            `/v1/analytics/libraries/${pathSegment(fileKey)}/variable/actions`,
            [method("GET"), query(options)],
          );
        },
        getLibraryAnalyticsVariableUsages: async (
          fileKey: GetLibraryAnalyticsVariableUsagesPathParams["file_key"],
          options: GetLibraryAnalyticsVariableUsagesQueryParams,
        ) => {
          return endpoint<GetLibraryAnalyticsVariableUsagesResponse>(
            `/v1/analytics/libraries/${pathSegment(fileKey)}/variable/usages`,
            [method("GET"), query(options)],
          );
        },
      },
      oembed: {
        getOEmbed: async (options: GetOEmbedQueryParams) => {
          return endpoint<GetOEmbedResponse>(`/v1/oembed`, [method("GET"), query(options)]);
        },
      },
    },
    v2: {
      webhooks: {
        getWebhooks: async (options?: GetWebhooksQueryParams) => {
          const transformers = [method("GET")];
          if (options) {
            transformers.push(query(options));
          }
          return endpoint<GetWebhooksResponse>(`/v2/webhooks`, transformers);
        },
        postWebhook: async (obj: PostWebhookRequestBody) => {
          return endpoint<PostWebhookResponse>(`/v2/webhooks`, [
            method("POST"),
            body(JSON.stringify(obj)),
          ]);
        },
        getWebhook: async (webhookId: GetWebhookPathParams["webhook_id"]) => {
          return endpoint<GetWebhookResponse>(`/v2/webhooks/${pathSegment(webhookId)}`, [
            method("GET"),
          ]);
        },
        putWebhook: async (
          webhookId: PutWebhookPathParams["webhook_id"],
          obj: PutWebhookRequestBody,
        ) => {
          return endpoint<PutWebhookResponse>(`/v2/webhooks/${pathSegment(webhookId)}`, [
            method("PUT"),
            body(JSON.stringify(obj)),
          ]);
        },
        deleteWebhook: async (webhookId: DeleteWebhookPathParams["webhook_id"]) => {
          return endpoint<DeleteWebhookResponse>(`/v2/webhooks/${pathSegment(webhookId)}`, [
            method("DELETE"),
          ]);
        },
        getWebhookRequests: async (webhookId: GetWebhookRequestsPathParams["webhook_id"]) => {
          return endpoint<GetWebhookRequestsResponse>(
            `/v2/webhooks/${pathSegment(webhookId)}/requests`,
            [method("GET")],
          );
        },
      },
      teams: {
        getTeamWebhooks: async (teamId: GetTeamWebhooksPathParams["team_id"]) => {
          return endpoint<GetTeamWebhooksResponse>(`/v2/teams/${pathSegment(teamId)}/webhooks`, [
            method("GET"),
          ]);
        },
      },
    },
  };
};
