"use client";

import { useState } from "react";
import { convertUrlToEpub } from "@/lib/convert";
import { saveEpub, getEpub } from "@/lib/db";

export default function Home() {
  const [url, setUrl] = useState("");
  const [includeMedia, setIncludeMedia] = useState(true);
  const [eInk, setEInk] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isConverting, setIsConverting] = useState(false);
  const [epubReady, setEpubReady] = useState(false);
  const [error, setError] = useState("");

  const handleConvert = async () => {
    if (!url) return;
    setIsConverting(true);
    setEpubReady(false);
    setError("");
    setProgress(0);
    try {
      const blob = await convertUrlToEpub(url, includeMedia, eInk, setProgress);
      await saveEpub(blob);
      setEpubReady(true);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      setError(errorMessage);
      console.error('Conversion failed:', err);
    } finally {
      setIsConverting(false);
    }
  };

  const handleDownload = async () => {
    const blob = await getEpub();
    if (blob) {
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      const title = url.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0];
      a.download = `${title}.epub`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 text-slate-900 dark:text-white">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 to-purple-600/10 dark:from-blue-900/20 dark:to-purple-900/20" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
          <div className="text-center">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-6">
              URL to EPUB Converter
            </h1>
            <p className="text-lg sm:text-xl text-slate-600 dark:text-slate-300 max-w-2xl mx-auto">
              Convert any webpage into an EPUB file for your e-reader.
            </p>
          </div>
        </div>
      </div>

      {/* App Section */}
      <div className="max-w-xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
        <div className="bg-white dark:bg-slate-800/50 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 p-6 sm:p-8 space-y-6">
          
          {/* URL Input */}
          <div>
            <label htmlFor="url-input" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Website URL
            </label>
            <input
              id="url-input"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
              required
              disabled={isConverting}
              className="w-full bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg p-3 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-blue-500 focus:outline-none transition disabled:opacity-50"
            />
          </div>

          {/* Options */}
          <div className="space-y-4">
            <label className="flex items-center justify-between bg-slate-100 dark:bg-slate-700/50 p-3 rounded-lg">
              <span className="text-slate-700 dark:text-slate-300">Include media (images)</span>
              <input
                type="checkbox"
                checked={includeMedia}
                onChange={(e) => setIncludeMedia(e.target.checked)}
                disabled={isConverting}
                className="h-6 w-10 appearance-none rounded-full bg-slate-300 dark:bg-slate-600 transition-colors checked:bg-blue-600 relative cursor-pointer"
              />
            </label>
            <label className="flex items-center justify-between bg-slate-100 dark:bg-slate-700/50 p-3 rounded-lg">
              <span className="text-slate-700 dark:text-slate-300">Optimize for e-ink devices</span>
              <input
                type="checkbox"
                checked={eInk}
                onChange={(e) => setEInk(e.target.checked)}
                disabled={isConverting}
                className="h-6 w-10 appearance-none rounded-full bg-slate-300 dark:bg-slate-600 transition-colors checked:bg-blue-600 relative cursor-pointer"
              />
            </label>
          </div>

          {/* Convert Button */}
          <button
            onClick={handleConvert}
            disabled={isConverting || !url}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isConverting ? "Converting..." : "Convert to EPUB"}
          </button>

          {/* Progress Bar */}
          {isConverting && (
            <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5">
              <div
                className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          )}

          {/* Download Button */}
          {epubReady && (
            <button
              onClick={handleDownload}
              className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-6 rounded-lg transition-colors"
            >
              Download EPUB
            </button>
          )}

          {/* Error Message */}
          {error && (
            <div className="mt-4 p-4 bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-600 text-red-700 dark:text-red-300 rounded-lg">
              <p className="font-semibold">Error</p>
              <p>{error}</p>
            </div>
          )}

        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Tools Service
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
}