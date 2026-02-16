"use client";

import { useState, useMemo } from "react";
import colophonData from "@/data/colophon.json";
import Link from "next/link";

interface Credit {
  name: string;
  description?: string;
  url?: string;
}

interface Author {
  name: string;
  url?: string;
}

interface App {
  name: string;
  title: string;
  description: string;
  tags: string[];
  url: string;
  credits: Credit[];
  has_credits: boolean;
  author?: Author;
}

// Levenshtein distance for fuzzy matching
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

// Calculate similarity score (lower is better, 0 = exact match)
function calculateSimilarity(query: string, text: string): number {
  const queryLower = query.toLowerCase().trim();
  const textLower = text.toLowerCase();

  // Exact substring match gets score 0
  if (textLower.includes(queryLower)) {
    return 0;
  }

  // Levenshtein-based fuzzy matching
  const distance = levenshteinDistance(queryLower, textLower.substring(0, queryLower.length + 20));
  return distance;
}

// Check if query matches tags (normalized)
function matchesTags(query: string, tags: string[]): boolean {
  const queryLower = query.toLowerCase().trim();
  return tags.some((tag) => {
    const tagLower = tag.toLowerCase();
    if (tagLower.includes(queryLower)) return true;
    if (queryLower.includes(tagLower)) return true;
    return levenshteinDistance(queryLower, tagLower) <= Math.max(2, queryLower.length / 3);
  });
}

// Normalize text for search
function normalizeForSearch(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, "");
}

// Get credit display text
function getCreditDisplay(app: App): { name: string; url?: string } {
  if (app.author) {
    return { name: app.author.name, url: app.author.url };
  }
  if (app.credits && app.credits.length > 0) {
    return { name: app.credits[0].name, url: app.credits[0].url };
  }
  return { name: "toozej" };
}

export default function Home() {
  const [searchQuery, setSearchQuery] = useState("");

  const apps: App[] = colophonData.apps;

  const filteredApps = useMemo(() => {
    if (!searchQuery.trim()) {
      return apps;
    }

    const query = searchQuery.toLowerCase().trim();
    const queryNormalized = normalizeForSearch(query);

    return apps.filter((app) => {
      // Check name
      if (normalizeForSearch(app.name).includes(queryNormalized)) {
        return true;
      }

      // Check title
      if (normalizeForSearch(app.title).includes(queryNormalized)) {
        return true;
      }

      // Check description
      if (normalizeForSearch(app.description).includes(queryNormalized)) {
        return true;
      }

      // Check tags
      if (matchesTags(query, app.tags)) {
        return true;
      }

      // Fuzzy match on title with Levenshtein
      if (calculateSimilarity(query, app.title) <= Math.max(3, query.length / 2)) {
        return true;
      }

      return false;
    });
  }, [apps, searchQuery]);

  const resultCount = filteredApps.length;
  const totalApps = apps.length;
  const hasSearch = searchQuery.trim().length > 0;

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 to-purple-600/10 dark:from-blue-900/20 dark:to-purple-900/20" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
          <div className="text-center">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-slate-900 dark:text-white mb-6">
              Tools Collection
            </h1>
            <p className="text-lg sm:text-xl text-slate-600 dark:text-slate-300 max-w-2xl mx-auto">
              A curated collection of web applications and utilities designed to make your workflow easier.
            </p>

            {/* Search Bar */}
            <div className="mt-8 max-w-xl mx-auto">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <svg
                    className="h-5 w-5 text-slate-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                </div>
                <input
                  type="text"
                  placeholder="Search apps by name, description, or tags..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="block w-full pl-11 pr-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm transition-all duration-200"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center"
                  >
                    <svg
                      className="h-5 w-5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                )}
              </div>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                {hasSearch ? (
                  <>
                    Found {resultCount} {resultCount === 1 ? "app" : "apps"} matching &quot;{searchQuery}&quot;
                  </>
                ) : (
                  <>{totalApps} apps available</>
                )}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Empty State */}
      {hasSearch && resultCount === 0 && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
          <div className="text-center py-16">
            <svg
              className="mx-auto h-16 w-16 text-slate-300 dark:text-slate-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <h3 className="mt-4 text-lg font-medium text-slate-900 dark:text-white">No apps found</h3>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Try searching for something else, like &quot;markdown&quot;, &quot;qr&quot;, or &quot;github&quot;.
            </p>
            <button
              onClick={() => setSearchQuery("")}
              className="mt-6 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
            >
              Clear search
            </button>
          </div>
        </div>
      )}

      {/* Apps Grid */}
      {!hasSearch || resultCount > 0 ? (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {(hasSearch ? filteredApps : apps).map((app) => (
              <Link
                key={app.name}
                href={app.url}
                className="group relative bg-white dark:bg-slate-800 rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 border border-slate-200 dark:border-slate-700 overflow-hidden"
              >
                {/* Card Header with Icon */}
                <div className="p-6 pb-4">
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg shadow-lg group-hover:scale-110 transition-transform duration-300">
                      {app.title.charAt(0)}
                    </div>
                    <svg
                      className="w-5 h-5 text-slate-400 group-hover:text-blue-500 transition-colors duration-300"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                      />
                    </svg>
                  </div>

                  {/* Title */}
                  <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors duration-300">
                    {app.title}
                  </h2>

                  {/* Description */}
                  <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed line-clamp-3">
                    {app.description}
                  </p>
                </div>

                {/* Card Footer */}
                <div className="px-6 pb-6">
                  {/* Credit Badge */}
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs text-slate-500 dark:text-slate-400">by</span>
                    {(() => {
                      const credit = getCreditDisplay(app);
                      return credit.url ? (
                        <a
                          href={credit.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {credit.name}
                        </a>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                          {credit.name}
                        </span>
                      );
                    })()}
                  </div>

                  {app.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {app.tags.map((tag) => (
                        <span
                          key={tag}
                          className="px-2 py-1 text-xs font-medium bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Action hint */}
                  <div className="mt-4 flex items-center text-sm font-medium text-blue-600 dark:text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <span>Open app</span>
                    <svg
                      className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform duration-300"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </div>
                </div>

                {/* Hover gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Generated on {new Date(colophonData.generated_at).toLocaleDateString()}
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Tools Service
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
}
