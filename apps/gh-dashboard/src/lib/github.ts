import { GitHubRepo, GitHubWorkflowRun, GitHubRelease, GitHubCommit, RateLimitInfo } from "@/types/github";

const GITHUB_API_BASE = "https://api.github.com";

// Rate limiting state (per-request, tracked from responses)
const rateLimitState: RateLimitInfo = {
  limit: 60,
  remaining: 60,
  reset: 0,
  used: 0,
};

// Cache for storing API responses
const cache = new Map<string, { data: unknown; timestamp: number; token?: string }>();
// Cache duration in milliseconds (default: 5 minutes, configurable via env var)
const CACHE_DURATION = parseInt(process.env.GITHUB_CACHE_DURATION_MS || "300000", 10); // 5 minutes default

export function getRateLimitInfo(): RateLimitInfo {
  return { ...rateLimitState };
}

export function isRateLimited(): boolean {
  return rateLimitState.remaining <= 0;
}

function updateRateLimit(headers: Headers) {
  const limit = headers.get("x-ratelimit-limit");
  const remaining = headers.get("x-ratelimit-remaining");
  const reset = headers.get("x-ratelimit-reset");
  const used = headers.get("x-ratelimit-used");

  if (limit) rateLimitState.limit = parseInt(limit, 10);
  if (remaining) rateLimitState.remaining = parseInt(remaining, 10);
  if (reset) rateLimitState.reset = parseInt(reset, 10);
  if (used) rateLimitState.used = parseInt(used, 10);
}

function getCacheKey(endpoint: string, token?: string): string {
  return `${token ? "with-token" : "no-token"}:${endpoint}`;
}

function getCached<T>(endpoint: string, token?: string): T | null {
  const cached = cache.get(getCacheKey(endpoint, token));
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data as T;
  }
  return null;
}

function setCache(endpoint: string, data: unknown, token?: string): void {
  cache.set(getCacheKey(endpoint, token), { data, timestamp: Date.now(), token });
}

async function fetchWithRateLimit<T>(endpoint: string, token?: string, useCache = true): Promise<T> {
  // Check cache first
  if (useCache) {
    const cached = getCached<T>(endpoint, token);
    if (cached) return cached;
  }

  // Check rate limit (only for unauthenticated requests)
  if (!token && isRateLimited()) {
    throw new Error("Rate limited. Please wait before making more requests.");
  }

  const headers: HeadersInit = {
    Accept: "application/vnd.github.v3+json",
  };

  // Add auth token if provided (increases rate limit to 5000/hour)
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  // Calculate Next.js revalidate time in seconds (from CACHE_DURATION ms)
  const revalidateSeconds = useCache ? Math.floor(CACHE_DURATION / 1000) : 0;

  const response = await fetch(`${GITHUB_API_BASE}${endpoint}`, {
    headers,
    next: { revalidate: revalidateSeconds }, // Next.js cache
  });

  updateRateLimit(response.headers);

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("401: Bad credentials - The token is invalid");
    }
    if (response.status === 403) {
      const resetTime = new Date(rateLimitState.reset * 1000);
      const message = response.headers.get("x-ratelimit-remaining") === "0"
        ? `Rate limited. Resets at ${resetTime.toISOString()}`
        : "403: Forbidden - You may not have permission to access this resource";
      throw new Error(message);
    }
    if (response.status === 404) {
      throw new Error(`404: Not found - ${endpoint}`);
    }
    throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  // Cache the response
  if (useCache) {
    setCache(endpoint, data, token);
  }

  return data as T;
}

export async function getUserRepos(username: string, token?: string): Promise<GitHubRepo[]> {
  return fetchWithRateLimit<GitHubRepo[]>(`/users/${username}/repos?sort=updated&per_page=100`, token);
}

export async function getRepoWorkflowRuns(
  owner: string,
  repo: string,
  branch?: string,
  token?: string
): Promise<GitHubWorkflowRun[]> {
  let endpoint = `/repos/${owner}/${repo}/actions/runs?per_page=10`;
  if (branch) {
    endpoint += `&branch=${branch}`;
  }

  const data = await fetchWithRateLimit<{ workflow_runs: GitHubWorkflowRun[] }>(endpoint, token);
  return data.workflow_runs;
}

export async function getRepoReleases(owner: string, repo: string, token?: string): Promise<GitHubRelease[]> {
  const data = await fetchWithRateLimit<GitHubRelease[]>(
    `/repos/${owner}/${repo}/releases?per_page=5`,
    token
  );
  return data;
}

export async function getRepoCommits(
  owner: string,
  repo: string,
  branch?: string,
  token?: string
): Promise<GitHubCommit[]> {
  let endpoint = `/repos/${owner}/${repo}/commits?per_page=5`;
  if (branch) {
    endpoint += `&sha=${branch}`;
  }

  const data = await fetchWithRateLimit<GitHubCommit[]>(endpoint, token);
  return data;
}

export async function getRepo(
  owner: string,
  repo: string,
  token?: string
): Promise<GitHubRepo> {
  return fetchWithRateLimit<GitHubRepo>(`/repos/${owner}/${repo}`, token);
}

export async function getAuthenticatedUser(token: string): Promise<{ login: string }> {
  return fetchWithRateLimit<{ login: string }>("/user", token);
}

export async function getRateLimitStatus(token?: string): Promise<{
  rate: { limit: number; remaining: number; reset: number; used: number };
}> {
  return fetchWithRateLimit<{ rate: RateLimitInfo }>("/rate_limit", token, false);
}
