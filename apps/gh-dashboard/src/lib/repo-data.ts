import { RepoStatus, RateLimitInfo } from "@/types/github";
import {
  getUserRepos,
  getRepoWorkflowRuns,
  getRepoReleases,
  getRepoCommits,
  getRateLimitInfo,
} from "@/lib/github";

export async function fetchRepoStatus(username: string): Promise<{
  repos: RepoStatus[];
  rateLimit: RateLimitInfo;
  error?: string;
}> {
  try {
    // Fetch all user repos
    const repos = await getUserRepos(username);

    // Exclude archived repos
    const activeRepos = repos.filter((repo) => !repo.archived);

    // Fetch additional data for each repo in parallel
    const repoStatuses: RepoStatus[] = await Promise.all(
      activeRepos.map(async (repo): Promise<RepoStatus> => {
        const { owner, name } = repo;

        // Fetch workflows, releases, and commits in parallel
        const [workflowRuns, releases, commits] = await Promise.allSettled([
          getRepoWorkflowRuns(owner.login, name, undefined),
          getRepoReleases(owner.login, name),
          getRepoCommits(owner.login, name, undefined),
        ]);

        // Get main branch workflow run
        const mainRuns = workflowRuns.status === "fulfilled" ? workflowRuns.value : [];
        const mainWorkflowRun = mainRuns.find((run) => run.head_branch === "main" || run.head_branch === "master")
          || mainRuns[0]
          || null;

        // Get latest release
        const latestRelease = releases.status === "fulfilled" ? releases.value[0] || null : null;

        // Get latest commit
        const latestCommit = commits.status === "fulfilled" ? commits.value[0] || null : null;

        // Determine build status
        let buildStatus: RepoStatus["buildStatus"] = "unknown";
        if (mainWorkflowRun) {
          if (mainWorkflowRun.status === "queued" || mainWorkflowRun.status === "in_progress") {
            buildStatus = "running";
          } else if (mainWorkflowRun.conclusion === "success") {
            buildStatus = "passing";
          } else if (mainWorkflowRun.conclusion === "failure") {
            buildStatus = "failing";
          }
        }

        return {
          repo,
          mainWorkflowRun,
          latestRelease,
          latestCommit,
          openPullRequests: repo.open_issues_count,
          buildStatus,
        };
      })
    );

    return {
      repos: repoStatuses,
      rateLimit: getRateLimitInfo(),
    };
  } catch (error) {
    return {
      repos: [],
      rateLimit: getRateLimitInfo(),
      error: error instanceof Error ? error.message : "Failed to fetch repository data",
    };
  }
}

export function sortRepos(
  repos: RepoStatus[],
  sortBy: "updated" | "name" | "stars",
  sortOrder: "asc" | "desc"
): RepoStatus[] {
  return [...repos].sort((a, b) => {
    let comparison = 0;

    switch (sortBy) {
      case "updated":
        // Sort by updated_at: desc = newest first, asc = oldest first
        comparison = new Date(b.repo.updated_at).getTime() - new Date(a.repo.updated_at).getTime();
        break;
      case "name":
        comparison = a.repo.name.localeCompare(b.repo.name);
        break;
      case "stars":
        comparison = b.repo.stargazers_count - a.repo.stargazers_count;
        break;
    }

    // For descending, we want newest first (positive comparison means b comes first)
    // For ascending, we want oldest first (negative comparison means a comes first)
    return sortOrder === "desc" ? comparison : -comparison;
  });
}

export function filterRepos(
  repos: RepoStatus[],
  search: string,
  language: string,
  status: string
): RepoStatus[] {
  return repos.filter((repoStatus) => {
    const { repo, buildStatus } = repoStatus;

    // Search filter
    if (search) {
      const searchLower = search.toLowerCase();
      const matchesName = repo.name.toLowerCase().includes(searchLower);
      const matchesDescription = repo.description?.toLowerCase().includes(searchLower) ?? false;
      const matchesOwner = repo.owner.login.toLowerCase().includes(searchLower);
      if (!matchesName && !matchesDescription && !matchesOwner) {
        return false;
      }
    }

    // Language filter
    if (language && repo.language !== language) {
      return false;
    }

    // Status filter
    if (status && buildStatus !== status) {
      return false;
    }

    return true;
  });
}

export function getUniqueLanguages(repos: RepoStatus[]): string[] {
  const languages = new Set<string>();
  repos.forEach((rs) => {
    if (rs.repo.language) {
      languages.add(rs.repo.language);
    }
  });
  return Array.from(languages).sort();
}
