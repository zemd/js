import { optionalEnv, requireEnv } from "../env";
import { createGitHubApi, type GitHubApi } from "../github";

export const apiFromEnv = (): GitHubApi =>
  createGitHubApi({
    token: requireEnv("GITHUB_TOKEN"),
    repository: requireEnv("GITHUB_REPOSITORY"),
    apiUrl: optionalEnv("GITHUB_API_URL", "https://api.github.com"),
    graphqlUrl: optionalEnv("GITHUB_GRAPHQL_URL", "https://api.github.com/graphql"),
  });
