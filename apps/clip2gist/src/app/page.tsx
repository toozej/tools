'use client'

import { useState } from 'react'
import { useSession, signIn, signOut } from 'next-auth/react'

export default function Home() {
  const { data: session, status } = useSession()
  const [content, setContent] = useState('')
  const [filename, setFilename] = useState('')
  const [gistUrl, setGistUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        setContent(e.target?.result as string)
        setFilename(file.name)
      }
      reader.readAsText(file)
    }
  }

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText()
      setContent(text)
      setError('') // Clear any previous error on successful paste
    } catch {
      setError('Failed to read clipboard. Please grant clipboard permissions or paste manually.')
    }
  }

  const createGist = async () => {
    if (!content.trim()) {
      setError('Content is required to create a Gist.')
      return
    }

    setLoading(true)
    setError('')
    setGistUrl('')

    try {
      const response = await fetch('/api/create-gist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, filename: filename || 'gist.txt' }),
      })

      const data = await response.json()

      if (response.ok) {
        setGistUrl(data.url)
        await navigator.clipboard.writeText(data.url)
        setError('') // Clear error on success
      } else {
        setError(data.error || 'Failed to create Gist.')
      }
    } catch {
      setError('Failed to create Gist. Please check your network connection or try again.')
    } finally {
      setLoading(false)
    }
  }

  // Common wrapper for all states
  const appContent = (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 text-slate-900 dark:text-white">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 to-purple-600/10 dark:from-blue-900/20 dark:to-purple-900/20" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 text-center">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-6">
            GitHub Gist Creator
          </h1>
          <p className="text-lg sm:text-xl text-slate-600 dark:text-slate-300 max-w-2xl mx-auto">
            Create private GitHub gists directly from your clipboard or files.
          </p>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
        <div className="bg-white dark:bg-slate-800/50 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 p-6 sm:p-8 space-y-6">
          {status === 'loading' && (
            <div className="text-center py-10">
              <p className="text-lg text-slate-600 dark:text-slate-300">Loading user session...</p>
            </div>
          )}

          {!session && status !== 'loading' && (
            <div className="text-center py-10 space-y-4">
              <p className="text-lg text-slate-700 dark:text-slate-300">
                Sign in with GitHub to create private gists.
              </p>
              <button
                onClick={() => signIn('github')}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition-colors"
              >
                Sign in with GitHub
              </button>
            </div>
          )}

          {status === 'authenticated' && (
            <>
              <div className="flex justify-between items-center pb-4 border-b border-slate-200 dark:border-slate-700 mb-6">
                <h2 className="text-xl font-semibold text-slate-800 dark:text-white">
                  Welcome, {session.user?.name || 'User'}!
                </h2>
                <button
                  onClick={() => signOut()}
                  className="text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
                >
                  Sign out
                </button>
              </div>

              <div>
                <label htmlFor="content-input" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Content
                </label>
                <textarea
                  id="content-input"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Paste your content here or upload a file"
                  className="w-full h-64 p-3 border border-slate-300 dark:border-slate-600 rounded-lg font-mono text-sm bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-blue-500 focus:outline-none transition resize-y"
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={handlePaste}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition-colors"
                >
                  Paste from Clipboard
                </button>

                <input
                  type="file"
                  onChange={handleFileUpload}
                  accept="text/*"
                  className="flex-1 block w-full text-sm text-slate-500 dark:text-slate-400
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-full file:border-0
                  file:text-sm file:font-semibold
                  file:bg-blue-50 dark:file:bg-blue-900/20 file:text-blue-700 dark:file:text-blue-400
                  hover:file:bg-blue-100 dark:hover:file:bg-blue-900/30 cursor-pointer"
                />
              </div>

              <div>
                <label htmlFor="filename-input" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Filename (optional)
                </label>
                <input
                  id="filename-input"
                  type="text"
                  value={filename}
                  onChange={(e) => setFilename(e.target.value)}
                  placeholder="gist.txt"
                  className="w-full p-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-blue-500 focus:outline-none transition"
                />
              </div>

              <button
                onClick={createGist}
                disabled={loading}
                className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Creating...' : 'Create Private Gist'}
              </button>

              {error && (
                <div className="mt-4 p-4 bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-600 text-red-700 dark:text-red-300 rounded-lg">
                  <p className="font-semibold">Error</p>
                  <p>{error}</p>
                </div>
              )}

              {gistUrl && (
                <div className="mt-4 p-4 bg-green-100 dark:bg-green-900/30 border border-green-400 dark:border-green-600 text-green-700 dark:text-green-300 rounded-lg text-center">
                  <p className="font-semibold mb-2">Gist created successfully! Link copied to clipboard.</p>
                  <a
                    href={gistUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
                  >
                    {gistUrl}
                  </a>
                </div>
              )}
            </>
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

  return appContent;
}