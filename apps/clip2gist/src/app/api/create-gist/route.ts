import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../../lib/auth'
import { Octokit } from '@octokit/rest'

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)

  if (!session?.accessToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { content, filename } = await request.json()

  if (!content) {
    return NextResponse.json({ error: 'Content is required' }, { status: 400 })
  }

  const octokit = new Octokit({ auth: session.accessToken })

  try {
    const gist = await octokit.gists.create({
      public: false,
      files: {
        [filename || 'gist.txt']: {
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