import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../../lib/auth'
import { validateCreateGistPayload, sanitizeFilename } from '../../../lib/validation'
import { Octokit } from '@octokit/rest'

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)

  if (!session?.accessToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()

  const validation = validateCreateGistPayload(body)
  if (!validation.valid) {
    return NextResponse.json({ error: validation.error }, { status: 400 })
  }

  const { content, filename } = body
  const safeFilename = sanitizeFilename(filename)

  const octokit = new Octokit({ auth: session.accessToken })

  try {
    const gist = await octokit.gists.create({
      public: false,
      files: {
        [safeFilename]: {
          content,
        },
      },
    })

    return NextResponse.json({ url: gist.data.html_url })
  } catch (error) {
    console.error('Error creating gist:', error)
    return NextResponse.json({ error: 'Failed to create gist' }, { status: 500 })
  }
}