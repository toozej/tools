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

  const handleConvert = async () => {
    if (!url) return;
    setIsConverting(true);
    setProgress(0);
    setEpubReady(false);
    try {
      const blob = await convertUrlToEpub(url, includeMedia, eInk, setProgress);
      await saveEpub(blob);
      setEpubReady(true);
    } catch (error) {
      console.error('Conversion failed:', error);
      alert('Failed to convert URL. Check console for details.');
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
      a.download = 'converted.epub';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 sm:p-8">
      <div className="w-full max-w-md space-y-4">
        <h1 className="text-2xl font-bold text-center">URL to EPUB Converter</h1>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Enter URL"
          className="w-full p-2 border rounded"
          disabled={isConverting}
        />
        <div className="space-y-2">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={includeMedia}
              onChange={(e) => setIncludeMedia(e.target.checked)}
              disabled={isConverting}
            />
            <span className="ml-2">Include media (images)</span>
          </label>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={eInk}
              onChange={(e) => setEInk(e.target.checked)}
              disabled={isConverting}
            />
            <span className="ml-2">Optimize for e-ink devices</span>
          </label>
        </div>
        <button
          onClick={handleConvert}
          disabled={isConverting || !url}
          className="w-full p-2 bg-blue-500 text-white rounded disabled:opacity-50"
        >
          {isConverting ? "Converting..." : "Convert to EPUB"}
        </button>
        {isConverting && (
          <progress value={progress} max={100} className="w-full" />
        )}
        {epubReady && (
          <button
            onClick={handleDownload}
            className="w-full p-2 bg-green-500 text-white rounded"
          >
            Download EPUB
          </button>
        )}
      </div>
    </main>
  );
}
