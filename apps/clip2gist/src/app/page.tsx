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
    } catch {
      setError('Failed to read clipboard')
    }
  }

  const createGist = async () => {
    if (!content.trim()) {
      setError('Content is required')
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
      } else {
        setError(data.error || 'Failed to create gist')
      }
    } catch {
      setError('Failed to create gist')
    } finally {
      setLoading(false)
    }
  }

  if (status === 'loading') {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-8">
        <p>Loading...</p>
      </main>
    )
  }

  if (!session) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">GitHub Gist Creator</h1>
          <p className="mb-4">Sign in with GitHub to create private gists</p>
          <button
            onClick={() => signIn('github')}
            className="bg-black text-white px-4 py-2 rounded hover:bg-gray-800"
          >
            Sign in with GitHub
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen p-4 md:p-8 max-w-2xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold">GitHub Gist Creator</h1>
        <button
          onClick={() => signOut()}
          className="text-sm text-gray-600 hover:text-gray-800"
        >
          Sign out
        </button>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">Content</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Paste your content here or upload a file"
            className="w-full h-64 p-3 border rounded resize-none"
          />
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <button
            onClick={handlePaste}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Paste from Clipboard
          </button>

          <div className="flex-1">
            <input
              type="file"
              onChange={handleFileUpload}
              className="w-full"
              accept="text/*"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Filename (optional)</label>
          <input
            type="text"
            value={filename}
            onChange={(e) => setFilename(e.target.value)}
            placeholder="gist.txt"
            className="w-full p-2 border rounded"
          />
        </div>

        <button
          onClick={createGist}
          disabled={loading}
          className="w-full py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
        >
          {loading ? 'Creating...' : 'Create Private Gist'}
        </button>

        {error && (
          <p className="text-red-500 text-center">{error}</p>
        )}

        {gistUrl && (
          <div className="text-center">
            <p className="mb-2">Gist created successfully! Link copied to clipboard.</p>
            <a
              href={gistUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 underline"
            >
              {gistUrl}
            </a>
          </div>
        )}
      </div>
    </main>
  )
}
