"use client";

import { useState } from "react";

interface Bookmark { id: string; url: string; title: string; description: string }
interface Result { bookmarkId: string; title: string; labels: string[]; success: boolean; error?: string }
type Step = "config" | "fetching" | "ready" | "processing" | "complete";
const apiBase = "/readeck-labeler/api";

export default function Home() {
  const [step, setStep] = useState<Step>("config");
  const [readeckUrl, setReadeckUrl] = useState("");
  const [readeckToken, setReadeckToken] = useState("");
  const [llmUrl, setLlmUrl] = useState("");
  const [llmToken, setLlmToken] = useState("");
  const [llmModel, setLlmModel] = useState("");
  const [maxLabels, setMaxLabels] = useState(5);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [error, setError] = useState("");
  const config = { readeckUrl, readeckToken, llmUrl, llmToken, llmModel };

  async function send(path: string, body: object) {
    const response = await fetch(`${apiBase}/${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || `Request failed (HTTP ${response.status}).`);
    return data;
  }

  async function findBookmarks() {
    setStep("fetching");
    setError("");
    setResults([]);
    try {
      const data = await send("bookmarks", config);
      setBookmarks(data.bookmarks);
      setStep("ready");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not fetch bookmarks.");
      setStep("config");
    }
  }

  async function processBookmarks() {
    setStep("processing");
    setError("");
    setResults([]);
    for (const bookmark of bookmarks) {
      let result: Result;
      try {
        result = await send("process", { ...config, bookmarkId: bookmark.id, maxLabels });
      } catch (cause) {
        result = { bookmarkId: bookmark.id, title: bookmark.title, labels: [], success: false, error: cause instanceof Error ? cause.message : "Could not process bookmark." };
      }
      setResults((current) => [...current, result]);
    }
    setStep("complete");
  }

  const completed = results.length;
  const successes = results.filter((result) => result.success).length;
  const field = "mt-1 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 shadow-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:border-slate-600 dark:bg-slate-800 dark:text-white";
  const card = "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-7";
  const primary = "rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50";

  return <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 dark:bg-slate-950 dark:text-slate-100 sm:px-6">
    <div className="mx-auto max-w-5xl">
      <header className="mb-8"><p className="mb-2 text-sm font-semibold uppercase tracking-widest text-indigo-600 dark:text-indigo-400">Bookmark tools</p><h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Readeck Labeler</h1><p className="mt-3 max-w-2xl text-slate-600 dark:text-slate-400">Find bookmarks without labels. Review them before the LLM generates and applies labels.</p></header>
      <ol className="mb-7 grid gap-3 text-sm sm:grid-cols-3" aria-label="Workflow">
        {["1. Configure", "2. Review bookmarks", "3. Apply labels"].map((label, index) => <li key={label} className={`rounded-xl border px-4 py-3 ${(index === 0 && (step === "config" || step === "fetching")) || (index === 1 && step === "ready") || (index === 2 && (step === "processing" || step === "complete")) ? "border-indigo-500 bg-indigo-50 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200" : "border-slate-200 text-slate-500 dark:border-slate-700"}`}>{label}</li>)}
      </ol>
      {error && <div role="alert" className="mb-6 rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-rose-800 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-200">{error}</div>}
      {(step === "config" || step === "fetching") && <section className={card}>
        <h2 className="text-xl font-semibold">Connection settings</h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Leave a field empty to use its server environment variable. The server never sends environment tokens to the browser.</p>
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <fieldset className="space-y-4"><legend className="mb-3 font-semibold">Readeck</legend>
            <label className="block text-sm font-medium">Readeck URL<input className={field} type="url" value={readeckUrl} onChange={(event) => setReadeckUrl(event.target.value)} placeholder="From READECK_URL or enter a URL" /></label>
            <label className="block text-sm font-medium">Readeck API token<input className={field} type="password" value={readeckToken} onChange={(event) => setReadeckToken(event.target.value)} placeholder="From READECK_API_TOKEN or enter a token" autoComplete="off" /></label>
          </fieldset>
          <fieldset className="space-y-4"><legend className="mb-3 font-semibold">LLM</legend>
            <label className="block text-sm font-medium">LLM API URL<input className={field} type="url" value={llmUrl} onChange={(event) => setLlmUrl(event.target.value)} placeholder="From LLM_API_URL or enter a URL" /></label>
            <label className="block text-sm font-medium">Model<input className={field} value={llmModel} onChange={(event) => setLlmModel(event.target.value)} placeholder="From LLM_MODEL or enter a model" /></label>
            <label className="block text-sm font-medium">LLM API token<input className={field} type="password" value={llmToken} onChange={(event) => setLlmToken(event.target.value)} placeholder="From LLM_API_TOKEN or enter a token" autoComplete="off" /></label>
          </fieldset>
        </div>
        <div className="mt-6 flex flex-col gap-4 border-t border-slate-200 pt-6 dark:border-slate-700 sm:flex-row sm:items-end sm:justify-between">
          <label className="block text-sm font-medium">Max labels per bookmark<select className={field} value={maxLabels} onChange={(event) => setMaxLabels(Number(event.target.value))}>{Array.from({ length: 10 }, (_, index) => index + 1).map((count) => <option key={count} value={count}>{count}</option>)}</select></label>
          <button className={primary} onClick={findBookmarks} disabled={step === "fetching"}>{step === "fetching" ? "Finding bookmarks…" : "Find Unlabeled Bookmarks"}</button>
        </div>
      </section>}
      {step === "ready" && <section className={card}>
        <h2 className="text-xl font-semibold">Found {bookmarks.length} unlabeled bookmark{bookmarks.length === 1 ? "" : "s"}</h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Review the list before you apply up to {maxLabels} label{maxLabels === 1 ? "" : "s"} per bookmark.</p>
        <div className="mt-5 max-h-96 space-y-3 overflow-y-auto">{bookmarks.map((bookmark) => <article key={bookmark.id} className="rounded-xl border border-slate-200 p-4 dark:border-slate-700"><h3 className="font-semibold">{bookmark.title || bookmark.url || bookmark.id}</h3><p className="break-all text-sm text-slate-500">{bookmark.url}</p>{bookmark.description && <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{bookmark.description}</p>}</article>)}</div>
        <div className="mt-6 flex flex-wrap gap-3"><button className={primary} onClick={processBookmarks} disabled={bookmarks.length === 0}>Generate and Apply Labels</button><button className="rounded-xl border border-slate-300 px-5 py-3 font-semibold dark:border-slate-600" onClick={() => setStep("config")}>Edit settings</button></div>
      </section>}
      {(step === "processing" || step === "complete") && <section className={card}>
        <h2 className="text-xl font-semibold">{step === "complete" ? "Labeling complete" : "Generating and applying labels"}</h2>
        <p aria-live="polite" className="mt-2 text-sm text-slate-600 dark:text-slate-400">{completed} of {bookmarks.length} processed. {successes} labeled. {completed - successes} failed.</p>
        <div role="progressbar" aria-valuenow={completed} aria-valuemin={0} aria-valuemax={bookmarks.length} aria-label="Bookmarks processed" className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"><div className="h-full bg-indigo-600 transition-all" style={{ width: `${bookmarks.length ? completed / bookmarks.length * 100 : 100}%` }} /></div>
        <div className="mt-6 max-h-96 space-y-3 overflow-y-auto" aria-live="polite">{results.map((result) => <article key={result.bookmarkId} className="rounded-xl border border-slate-200 p-4 dark:border-slate-700"><h3 className="font-medium">{result.title || result.bookmarkId}</h3>{result.success ? <p className="mt-1 text-sm text-emerald-700 dark:text-emerald-400">Applied: {result.labels.join(", ")}</p> : <p className="mt-1 text-sm text-rose-700 dark:text-rose-400">Failed: {result.error}</p>}</article>)}</div>
        {step === "complete" && <button className={`${primary} mt-6`} onClick={findBookmarks}>Find Unlabeled Bookmarks Again</button>}
      </section>}
    </div>
  </main>;
}
