// Types for GitHub API responses

export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  updated_at: string;
  pushed_at: string;
  created_at: string;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  private: boolean;
  language: string | null;
  owner: {
    login: string;
    avatar_url: string;
    html_url: string;
  };
}

export interface GitHubWorkflowRun {
  id: number;
  name: string;
  head_branch: string;
  head_sha: string;
  status: "queued" | "in_progress" | "completed";
  conclusion: "success" | "failure" | "cancelled" | "skipped" | "timed_out" | null;
  html_url: string;
  run_started_at: string;
  updated_at: string;
  actor: {
    login: string;
    avatar_url: string;
  };
}

export interface GitHubRelease {
  id: number;
  tag_name: string;
  name: string | null;
  html_url: string;
  published_at: string;
  draft: boolean;
  prerelease: boolean;
  author: {
    login: string;
    avatar_url: string;
  };
}

export interface GitHubCommit {
  sha: string;
  commit: {
    message: string;
    author: {
      name: string;
      email: string;
      date: string;
    };
  };
  html_url: string;
  author: {
    login: string | null;
    avatar_url: string | null;
  };
}

export interface RepoStatus {
  repo: GitHubRepo;
  mainWorkflowRun: GitHubWorkflowRun | null;
  latestRelease: GitHubRelease | null;
  latestCommit: GitHubCommit | null;
  openPullRequests: number;
  buildStatus: "passing" | "failing" | "unknown" | "running";
}

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number;
  used: number;
}

export interface DashboardState {
  repos: RepoStatus[];
  rateLimit: RateLimitInfo;
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  filters: {
    search: string;
    language: string;
    status: string;
    sortBy: "updated" | "name" | "stars";
    sortOrder: "asc" | "desc";
  };
}
