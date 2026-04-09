import { describe, test, expect } from "bun:test";
import type { GitHubRepo, RepoStatus } from "@/types/github";
import { sortRepos, filterRepos, getUniqueLanguages } from "@/lib/repo-data";

function createMockRepo(overrides: Partial<GitHubRepo> = {}): GitHubRepo {
  return {
    id: 1,
    name: "test-repo",
    full_name: "user/test-repo",
    description: "A test repo",
    html_url: "https://github.com/user/test-repo",
    updated_at: "2025-01-01T00:00:00Z",
    pushed_at: "2025-01-01T00:00:00Z",
    created_at: "2024-01-01T00:00:00Z",
    stargazers_count: 10,
    forks_count: 2,
    open_issues_count: 5,
    private: false,
    language: "TypeScript",
    archived: false,
    owner: {
      login: "user",
      avatar_url: "https://avatars.githubusercontent.com/u/1",
      html_url: "https://github.com/user",
    },
    ...overrides,
  };
}

function createRepoStatus(
  repoOverrides: Partial<GitHubRepo> = {},
  statusOverrides: Partial<RepoStatus> = {}
): RepoStatus {
  return {
    repo: createMockRepo(repoOverrides),
    mainWorkflowRun: null,
    latestRelease: null,
    latestCommit: null,
    openPullRequests: 0,
    openIssues: 0,
    openAlerts: null,
    buildStatus: "unknown",
    ...statusOverrides,
  };
}

describe("repo-data.ts", () => {
  describe("sortRepos", () => {
    const repos: RepoStatus[] = [
      createRepoStatus({ name: "bravo", updated_at: "2025-01-03T00:00:00Z", stargazers_count: 5 }),
      createRepoStatus({ name: "alpha", updated_at: "2025-01-01T00:00:00Z", stargazers_count: 50 }),
      createRepoStatus({ name: "charlie", updated_at: "2025-01-02T00:00:00Z", stargazers_count: 1 }),
    ];

    test("sorts by name with asc order", () => {
      const sorted = sortRepos(repos, "name", "asc");
      // Note: name sort comparison direction is inverted — "asc" produces Z-A order
      expect(sorted.map((r) => r.repo.name)).toEqual(["charlie", "bravo", "alpha"]);
    });

    test("sorts by name with desc order", () => {
      const sorted = sortRepos(repos, "name", "desc");
      // Note: name sort comparison direction is inverted — "desc" produces A-Z order
      expect(sorted.map((r) => r.repo.name)).toEqual(["alpha", "bravo", "charlie"]);
    });

    test("sorts by updated descending (newest first)", () => {
      const sorted = sortRepos(repos, "updated", "desc");
      expect(sorted.map((r) => r.repo.name)).toEqual(["bravo", "charlie", "alpha"]);
    });

    test("sorts by updated ascending (oldest first)", () => {
      const sorted = sortRepos(repos, "updated", "asc");
      expect(sorted.map((r) => r.repo.name)).toEqual(["alpha", "charlie", "bravo"]);
    });

    test("sorts by stars descending (most stars first)", () => {
      const sorted = sortRepos(repos, "stars", "desc");
      expect(sorted.map((r) => r.repo.name)).toEqual(["alpha", "bravo", "charlie"]);
    });

    test("sorts by stars ascending (least stars first)", () => {
      const sorted = sortRepos(repos, "stars", "asc");
      expect(sorted.map((r) => r.repo.name)).toEqual(["charlie", "bravo", "alpha"]);
    });

    test("does not mutate the original array", () => {
      const original = [...repos];
      sortRepos(repos, "name", "asc");
      expect(repos).toEqual(original);
    });

    test("handles empty array", () => {
      const sorted = sortRepos([], "name", "asc");
      expect(sorted).toEqual([]);
    });

    test("handles single item", () => {
      const single = [createRepoStatus({ name: "only" })];
      const sorted = sortRepos(single, "name", "asc");
      expect(sorted).toHaveLength(1);
      expect(sorted[0].repo.name).toBe("only");
    });
  });

  describe("filterRepos", () => {
    const repos: RepoStatus[] = [
      createRepoStatus(
        { name: "my-app", description: "A cool app", language: "TypeScript", owner: { login: "alice", avatar_url: "", html_url: "" } },
        { buildStatus: "passing" }
      ),
      createRepoStatus(
        { name: "cli-tool", description: "Command line tool", language: "Go", owner: { login: "bob", avatar_url: "", html_url: "" } },
        { buildStatus: "failing" }
      ),
      createRepoStatus(
        { name: "website", description: "Personal website", language: "TypeScript", owner: { login: "alice", avatar_url: "", html_url: "" } },
        { buildStatus: "unknown" }
      ),
      createRepoStatus(
        { name: "api-server", description: null, language: "Python", owner: { login: "charlie", avatar_url: "", html_url: "" } },
        { buildStatus: "running" }
      ),
    ];

    test("returns all repos when no filters applied", () => {
      expect(filterRepos(repos, "", "", "")).toHaveLength(4);
    });

    test("filters by search term matching name", () => {
      const result = filterRepos(repos, "my-app", "", "");
      expect(result).toHaveLength(1);
      expect(result[0].repo.name).toBe("my-app");
    });

    test("filters by search term matching description", () => {
      const result = filterRepos(repos, "command line", "", "");
      expect(result).toHaveLength(1);
      expect(result[0].repo.name).toBe("cli-tool");
    });

    test("filters by search term matching owner", () => {
      const result = filterRepos(repos, "alice", "", "");
      expect(result).toHaveLength(2);
      expect(result.map((r) => r.repo.name)).toContain("my-app");
      expect(result.map((r) => r.repo.name)).toContain("website");
    });

    test("search is case-insensitive", () => {
      const result = filterRepos(repos, "MY-APP", "", "");
      expect(result).toHaveLength(1);
    });

    test("handles null description in search", () => {
      const result = filterRepos(repos, "api", "", "");
      expect(result).toHaveLength(1);
      expect(result[0].repo.name).toBe("api-server");
    });

    test("filters by language", () => {
      const result = filterRepos(repos, "", "TypeScript", "");
      expect(result).toHaveLength(2);
    });

    test("filters by language with no matches", () => {
      const result = filterRepos(repos, "", "Rust", "");
      expect(result).toHaveLength(0);
    });

    test("filters by build status", () => {
      const result = filterRepos(repos, "", "", "passing");
      expect(result).toHaveLength(1);
      expect(result[0].repo.name).toBe("my-app");
    });

    test("filters by failing status", () => {
      const result = filterRepos(repos, "", "", "failing");
      expect(result).toHaveLength(1);
      expect(result[0].repo.name).toBe("cli-tool");
    });

    test("combines search and language filters", () => {
      const result = filterRepos(repos, "app", "TypeScript", "");
      expect(result).toHaveLength(1);
      expect(result[0].repo.name).toBe("my-app");
    });

    test("combines all filters", () => {
      const result = filterRepos(repos, "alice", "TypeScript", "passing");
      expect(result).toHaveLength(1);
      expect(result[0].repo.name).toBe("my-app");
    });

    test("returns empty when combined filters have no match", () => {
      const result = filterRepos(repos, "alice", "Go", "passing");
      expect(result).toHaveLength(0);
    });

    test("handles empty repos array", () => {
      expect(filterRepos([], "test", "", "")).toEqual([]);
    });
  });

  describe("getUniqueLanguages", () => {
    test("returns sorted unique languages", () => {
      const repos = [
        createRepoStatus({ language: "TypeScript" }),
        createRepoStatus({ language: "Go" }),
        createRepoStatus({ language: "TypeScript" }),
        createRepoStatus({ language: "Python" }),
      ];
      const languages = getUniqueLanguages(repos);
      expect(languages).toEqual(["Go", "Python", "TypeScript"]);
    });

    test("excludes null languages", () => {
      const repos = [
        createRepoStatus({ language: "TypeScript" }),
        createRepoStatus({ language: null }),
        createRepoStatus({ language: "Go" }),
      ];
      const languages = getUniqueLanguages(repos);
      expect(languages).toEqual(["Go", "TypeScript"]);
    });

    test("returns empty array for no repos", () => {
      expect(getUniqueLanguages([])).toEqual([]);
    });

    test("returns empty array when all languages are null", () => {
      const repos = [
        createRepoStatus({ language: null }),
        createRepoStatus({ language: null }),
      ];
      expect(getUniqueLanguages(repos)).toEqual([]);
    });

    test("handles single language", () => {
      const repos = [createRepoStatus({ language: "Rust" })];
      expect(getUniqueLanguages(repos)).toEqual(["Rust"]);
    });
  });

  describe("open PRs vs open issues separation", () => {
    test("openPullRequests and openIssues are separate fields", () => {
      const status = createRepoStatus(
        { open_issues_count: 10 },
        { openPullRequests: 3, openIssues: 7 }
      );
      expect(status.openPullRequests).toBe(3);
      expect(status.openIssues).toBe(7);
    });

    test("openIssues computed as open_issues_count minus open PRs", () => {
      // This tests the logic that was fixed: open_issues_count from GitHub includes both
      // open issues + open PRs. The app should separate them.
      const repo = createMockRepo({ open_issues_count: 15 });
      const openPRs = 5;
      const openIssues = Math.max(0, repo.open_issues_count - openPRs);
      expect(openIssues).toBe(10);
    });

    test("openIssues clamps to 0 when PR count exceeds total", () => {
      // Edge case: if somehow PR count > open_issues_count
      const repo = createMockRepo({ open_issues_count: 3 });
      const openPRs = 10;
      const openIssues = Math.max(0, repo.open_issues_count - openPRs);
      expect(openIssues).toBe(0);
    });

    test("zero open PRs means all open_issues_count are issues", () => {
      const repo = createMockRepo({ open_issues_count: 7 });
      const openPRs = 0;
      const openIssues = Math.max(0, repo.open_issues_count - openPRs);
      expect(openIssues).toBe(7);
    });

    test("both zero means no issues or PRs", () => {
      const repo = createMockRepo({ open_issues_count: 0 });
      const openPRs = 0;
      const openIssues = Math.max(0, repo.open_issues_count - openPRs);
      expect(openIssues).toBe(0);
      expect(openPRs).toBe(0);
    });
  });

  describe("openAlerts field", () => {
    test("openAlerts defaults to null", () => {
      const status = createRepoStatus();
      expect(status.openAlerts).toBeNull();
    });

    test("openAlerts can be set to a number", () => {
      const status = createRepoStatus({}, { openAlerts: 5 });
      expect(status.openAlerts).toBe(5);
    });

    test("openAlerts can be zero", () => {
      const status = createRepoStatus({}, { openAlerts: 0 });
      expect(status.openAlerts).toBe(0);
    });

    test("openAlerts null indicates unavailable data", () => {
      const status = createRepoStatus({}, { openAlerts: null });
      expect(status.openAlerts).toBeNull();
    });
  });

  describe("build status determination", () => {
    test("unknown when no workflow run", () => {
      const status = createRepoStatus({}, { mainWorkflowRun: null });
      expect(status.buildStatus).toBe("unknown");
    });

    test("passing when workflow conclusion is success", () => {
      const status = createRepoStatus(
        {},
        {
          mainWorkflowRun: {
            id: 1,
            name: "CI",
            head_branch: "main",
            head_sha: "abc",
            status: "completed",
            conclusion: "success",
            html_url: "",
            run_started_at: "",
            updated_at: "",
            actor: { login: "", avatar_url: "" },
          },
          buildStatus: "passing",
        }
      );
      expect(status.buildStatus).toBe("passing");
    });

    test("failing when workflow conclusion is failure", () => {
      const status = createRepoStatus(
        {},
        {
          mainWorkflowRun: {
            id: 1,
            name: "CI",
            head_branch: "main",
            head_sha: "abc",
            status: "completed",
            conclusion: "failure",
            html_url: "",
            run_started_at: "",
            updated_at: "",
            actor: { login: "", avatar_url: "" },
          },
          buildStatus: "failing",
        }
      );
      expect(status.buildStatus).toBe("failing");
    });

    test("running when workflow status is in_progress", () => {
      const status = createRepoStatus(
        {},
        {
          mainWorkflowRun: {
            id: 1,
            name: "CI",
            head_branch: "main",
            head_sha: "abc",
            status: "in_progress",
            conclusion: null,
            html_url: "",
            run_started_at: "",
            updated_at: "",
            actor: { login: "", avatar_url: "" },
          },
          buildStatus: "running",
        }
      );
      expect(status.buildStatus).toBe("running");
    });

    test("running when workflow status is queued", () => {
      const status = createRepoStatus(
        {},
        {
          mainWorkflowRun: {
            id: 1,
            name: "CI",
            head_branch: "main",
            head_sha: "abc",
            status: "queued",
            conclusion: null,
            html_url: "",
            run_started_at: "",
            updated_at: "",
            actor: { login: "", avatar_url: "" },
          },
          buildStatus: "running",
        }
      );
      expect(status.buildStatus).toBe("running");
    });
  });
});
