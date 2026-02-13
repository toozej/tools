"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { RepoStatus, DashboardState } from "@/types/github";
import { filterRepos, sortRepos, getUniqueLanguages } from "@/lib/repo-data";

const BASE_PATH = '/gh-dashboard';

// Status icon component
function StatusIcon({ status }: { status: RepoStatus["buildStatus"] }) {
  const icons = {
    passing: (
      <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
      </svg>
    ),
    failing: (
      <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
      </svg>
    ),
    running: (
      <svg className="w-5 h-5 text-yellow-500 animate-spin" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
      </svg>
    ),
    unknown: (
      <svg className="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1-1 1 0 00v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
      </svg>
    ),
  };

  return icons[status];
}

// Workflow status icon with link
function WorkflowStatusIcon({ run }: { run: RepoStatus["mainWorkflowRun"] }) {
  if (!run) return <span className="text-gray-400 text-sm">No runs</span>;

  const status = run.status === "completed" ? run.conclusion : run.status;
  const isRunning = status === "queued" || status === "in_progress";

  const icons = {
    success: (
      <a href={run.html_url} target="_blank" rel="noopener noreferrer" className="text-green-500 hover:text-green-600" title="Passed">
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
        </svg>
      </a>
    ),
    failure: (
      <a href={run.html_url} target="_blank" rel="noopener noreferrer" className="text-red-500 hover:text-red-600" title="Failed">
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
        </svg>
      </a>
    ),
    running: (
      <a href={run.html_url} target="_blank" rel="noopener noreferrer" className="text-yellow-500 hover:text-yellow-600" title="Running">
        <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      </a>
    ),
  };

  if (status === "success") return icons.success;
  if (status === "failure") return icons.failure;
  if (isRunning) return icons.running;
  return <span className="text-gray-400 text-sm">Unknown</span>;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor(diff / (1000 * 60));

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return "Just now";
}

function formatDateTime(dateString: string): string {
  return new Date(dateString).toLocaleString();
}

function shortenSha(sha: string): string {
  return sha.substring(0, 7);
}

export default function Dashboard() {
  const [state, setState] = useState<DashboardState>({
    repos: [],
    rateLimit: { limit: 60, remaining: 60, reset: 0, used: 0 },
    isLoading: true,
    error: null,
    lastUpdated: null,
    filters: {
      search: "",
      language: "",
      status: "",
      sortBy: "updated",
      sortOrder: "desc",
    },
  });

  const [tokenEnabled, setTokenEnabled] = useState(true);
  const [username, setUsername] = useState("");
  const [isHydrated, setIsHydrated] = useState(false);
  const [rateLimitTimer, setRateLimitTimer] = useState<string | null>(null);

  // Get username from URL after hydration
  useEffect(() => {
    setUsername(new URLSearchParams(window.location.search).get("username") || "");
    setIsHydrated(true);
  }, []);

  // Fetch token status on mount
  useEffect(() => {
    async function fetchTokenStatus() {
      try {
        const response = await fetch(`${BASE_PATH}/api/token`);
        if (response.ok) {
          const data = await response.json();
          setTokenEnabled(data.enabled);
        }
      } catch {
        // Silently fail - token status is non-critical
      }
    }
    fetchTokenStatus();
  }, []);

  // Handle token toggle
  const handleTokenToggle = async () => {
    const action = tokenEnabled ? "disable" : "enable";
    try {
      const response = await fetch(`${BASE_PATH}/api/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (response.ok) {
        const data = await response.json();
        setTokenEnabled(data.enabled);
        // Refresh data with new token state
        fetchData(true);
      }
    } catch {
      // Silently fail
    }
  };

  // Update rate limit timer countdown
  useEffect(() => {
    if (state.rateLimit.remaining === 0 && state.rateLimit.reset > 0) {
      const updateTimer = () => {
        const now = Date.now();
        const resetTime = state.rateLimit.reset * 1000;
        const diff = resetTime - now;
        if (diff > 0) {
          const hours = Math.floor(diff / (1000 * 60 * 60));
          const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
          const seconds = Math.floor((diff % (1000 * 60)) / 1000);
          setRateLimitTimer(`${hours}h ${minutes}m ${seconds}s`);
        } else {
          setRateLimitTimer(null);
        }
      };

      updateTimer();
      const interval = setInterval(updateTimer, 1000);
      return () => clearInterval(interval);
    } else {
      setRateLimitTimer(null);
    }
  }, [state.rateLimit.remaining, state.rateLimit.reset]);

  const fetchData = useCallback(async (force = false) => {
    if (!username) {
      setState((prev) => ({ ...prev, isLoading: false, error: "Please provide a GitHub username" }));
      return;
    }

    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const url = `${BASE_PATH}/api/repos?username=${encodeURIComponent(username)}${force ? "&force=true" : ""}`;
      const response = await fetch(url);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch data");
      }

      setState((prev) => ({
        ...prev,
        repos: data.repos,
        rateLimit: data.rateLimit,
        isLoading: false,
        lastUpdated: new Date(),
        error: null,
      }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : "An error occurred",
      }));
    }
  }, [username]);

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Live refresh with configurable interval (default: 10 minutes = 600000ms)
  // Disabled when token is not enabled
  const POLLING_INTERVAL_MS = parseInt(
    process.env.NEXT_PUBLIC_POLLING_INTERVAL_MS || "600000",
    10
  );

  useEffect(() => {
    if (!username) return;
    if (!tokenEnabled) return; // Disable polling when token is disabled

    const interval = setInterval(() => {
      fetchData(false);
    }, POLLING_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [fetchData, username, POLLING_INTERVAL_MS, tokenEnabled]);

  // Filter and sort repos
  const filteredRepos = filterRepos(
    state.repos,
    state.filters.search,
    state.filters.language,
    state.filters.status
  );
  const sortedRepos = sortRepos(
    filteredRepos,
    state.filters.sortBy,
    state.filters.sortOrder
  );
  const languages = getUniqueLanguages(state.repos);

  const handleFilterChange = (key: string, value: string) => {
    setState((prev) => ({
      ...prev,
      filters: { ...prev.filters, [key]: value },
    }));
  };

  const handleForceRefresh = () => {
    fetchData(true);
  };

  // Show loading while hydrating
  if (!isHydrated) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="flex items-center justify-center">
          <svg className="animate-spin h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        </div>
      </div>
    );
  }

  if (!username) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 max-w-md w-full">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            GitHub Repo Status Dashboard
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Enter a GitHub username to view their repository status dashboard.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.target as HTMLFormElement;
              const input = form.elements.namedItem("username") as HTMLInputElement;
              window.location.search = `?username=${encodeURIComponent(input.value)}`;
            }}
          >
            <input
              type="text"
              name="username"
              placeholder="Enter GitHub username"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
              required
            />
            <button
              type="submit"
              className="w-full mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
            >
              View Dashboard
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                GitHub Repo Status
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Viewing repos for: <span className="font-medium">{username}</span>
              </p>
            </div>
            <div className="flex items-center gap-4 flex-wrap">
              {/* Rate limit indicator */}
              <div className="text-sm text-gray-500 dark:text-gray-400">
                {state.rateLimit.remaining === 0 ? (
                  <span className="text-red-500 font-medium">
                    Rate limited. Resets in: {rateLimitTimer || "..."}
                  </span>
                ) : (
                  <>
                    <span className={state.rateLimit.remaining < 10 ? "text-red-500 font-medium" : ""}>
                      {state.rateLimit.remaining}/{state.rateLimit.limit}
                    </span>
                    <span className="ml-1">requests remaining</span>
                  </>
                )}
              </div>
              {/* Token status indicator */}
              <div className="text-sm text-gray-500 dark:text-gray-400">
                <span className={tokenEnabled ? "text-green-600" : "text-yellow-600"}>
                  {tokenEnabled ? "● Token Enabled" : "○ Token Disabled"}
                </span>
              </div>
              {/* Token toggle button */}
              <button
                onClick={handleTokenToggle}
                className={`px-4 py-2 font-medium rounded-lg transition-colors flex items-center gap-2 ${
                  tokenEnabled
                    ? "bg-red-600 hover:bg-red-700 text-white"
                    : "bg-green-600 hover:bg-green-700 text-white"
                }`}
                title={tokenEnabled ? "Disable token to reduce rate limit usage" : "Reload token from environment"}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                {tokenEnabled ? "Unload Token" : "Reload Token"}
              </button>
              {/* Force refresh button */}
              <button
                onClick={handleForceRefresh}
                disabled={state.isLoading}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
              >
                <svg
                  className={`w-4 h-4 ${state.isLoading ? "animate-spin" : ""}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                Refresh
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Filters */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Search */}
            <div>
              <label htmlFor="search" className="sr-only">Search</label>
              <div className="relative">
                <svg
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                <input
                  type="text"
                  id="search"
                  placeholder="Search repos..."
                  value={state.filters.search}
                  onChange={(e) => handleFilterChange("search", e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                />
              </div>
            </div>

            {/* Language filter */}
            <div>
              <label htmlFor="language" className="sr-only">Language</label>
              <select
                id="language"
                value={state.filters.language}
                onChange={(e) => handleFilterChange("language", e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">All Languages</option>
                {languages.map((lang) => (
                  <option key={lang} value={lang}>{lang}</option>
                ))}
              </select>
            </div>

            {/* Status filter */}
            <div>
              <label htmlFor="status" className="sr-only">Status</label>
              <select
                id="status"
                value={state.filters.status}
                onChange={(e) => handleFilterChange("status", e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">All Statuses</option>
                <option value="passing">Passing</option>
                <option value="failing">Failing</option>
                <option value="running">Running</option>
                <option value="unknown">Unknown</option>
              </select>
            </div>

            {/* Sort */}
            <div>
              <label htmlFor="sort" className="sr-only">Sort</label>
              <select
                id="sort"
                value={`${state.filters.sortBy}-${state.filters.sortOrder}`}
                onChange={(e) => {
                  const [sortBy, sortOrder] = e.target.value.split("-") as ["updated" | "name" | "stars", "asc" | "desc"];
                  setState((prev) => ({
                    ...prev,
                    filters: { ...prev.filters, sortBy, sortOrder },
                  }));
                }}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="updated-desc">Recently Updated</option>
                <option value="updated-asc">Least Recently Updated</option>
                <option value="name-asc">Name (A-Z)</option>
                <option value="name-desc">Name (Z-A)</option>
                <option value="stars-desc">Most Stars</option>
                <option value="stars-asc">Least Stars</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Error state */}
      {state.error && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <div className="flex">
              <svg className="w-5 h-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <p className="ml-3 text-sm text-red-700 dark:text-red-400">{state.error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Loading state */}
      {state.isLoading && state.repos.length === 0 && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-center h-64">
            <svg className="animate-spin h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
        </div>
      )}

      {/* Repository table */}
      {!state.isLoading && sortedRepos.length > 0 && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900/50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Repository
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Build Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Latest Action
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Release
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Latest Commit
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Open PRs
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Updated
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {sortedRepos.map((repoStatus) => (
                    <tr key={repoStatus.repo.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10 relative">
                            <a href={repoStatus.repo.html_url} target="_blank" rel="noopener noreferrer">
                              <Image
                                className="rounded-full"
                                src={repoStatus.repo.owner.avatar_url}
                                alt={repoStatus.repo.owner.login}
                                width={40}
                                height={40}
                              />
                            </a>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                              <a href={repoStatus.repo.html_url} target="_blank" rel="noopener noreferrer" className="hover:text-blue-600 dark:hover:text-blue-400">
                                {repoStatus.repo.name}
                              </a>
                            </div>
                            <div className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-xs">
                              {repoStatus.repo.description || "No description"}
                            </div>
                            {repoStatus.repo.language && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 mt-1">
                                {repoStatus.repo.language}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2" title={`Build status: ${repoStatus.buildStatus}`}>
                          <StatusIcon status={repoStatus.buildStatus} />
                          <span className={`text-sm font-medium capitalize ${
                            repoStatus.buildStatus === "passing" ? "text-green-600 dark:text-green-400" :
                            repoStatus.buildStatus === "failing" ? "text-red-600 dark:text-red-400" :
                            repoStatus.buildStatus === "running" ? "text-yellow-600 dark:text-yellow-400" :
                            "text-gray-600 dark:text-gray-400"
                          }`}>
                            {repoStatus.buildStatus}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {repoStatus.mainWorkflowRun ? (
                          <div className="flex items-center gap-2">
                            <WorkflowStatusIcon run={repoStatus.mainWorkflowRun} />
                            <div className="text-sm">
                              <div className="text-gray-900 dark:text-white truncate max-w-[120px]" title={repoStatus.mainWorkflowRun.name}>
                                {repoStatus.mainWorkflowRun.name}
                              </div>
                              <div className="text-gray-500 dark:text-gray-400 text-xs">
                                {repoStatus.mainWorkflowRun.head_branch}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-400 text-sm">No runs</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {repoStatus.latestRelease ? (
                          <a
                            href={repoStatus.latestRelease.html_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                          >
                            {repoStatus.latestRelease.tag_name}
                          </a>
                        ) : (
                          <span className="text-gray-400 text-sm">No release</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {repoStatus.latestCommit ? (
                          <div className="text-sm">
                            <a
                              href={repoStatus.latestCommit.html_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 font-mono"
                              title={repoStatus.latestCommit.commit.message}
                            >
                              {shortenSha(repoStatus.latestCommit.sha)}
                            </a>
                            <div className="text-gray-500 dark:text-gray-400 text-xs truncate max-w-[150px]" title={repoStatus.latestCommit.commit.message}>
                              {repoStatus.latestCommit.commit.message.split("\n")[0]}
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-400 text-sm">No commits</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {repoStatus.openPullRequests !== undefined ? (
                          <a
                            href={`${repoStatus.repo.html_url}/pulls`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              repoStatus.openPullRequests > 0
                                ? "bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300"
                                : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
                            }`}
                          >
                            {repoStatus.openPullRequests}
                          </a>
                        ) : (
                          <span className="text-gray-400 text-sm">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500 dark:text-gray-400" title={formatDateTime(repoStatus.repo.updated_at)}>
                          {formatDate(repoStatus.repo.updated_at)}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Footer with stats */}
          <div className="mt-4 text-sm text-gray-500 dark:text-gray-400 flex flex-wrap gap-4">
            <span>Showing {sortedRepos.length} of {state.repos.length} repositories</span>
            {state.lastUpdated && (
              <span>Last updated: {formatDateTime(state.lastUpdated.toISOString())}</span>
            )}
            <span className="ml-auto">
              {tokenEnabled
                ? `Auto-refreshes every ${Math.floor(POLLING_INTERVAL_MS / 60000)} minutes`
                : "Auto-refresh disabled (token unloaded)"}
            </span>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!state.isLoading && sortedRepos.length === 0 && state.repos.length > 0 && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No repositories found</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Try adjusting your filters.</p>
          </div>
        </div>
      )}
    </div>
  );
}
