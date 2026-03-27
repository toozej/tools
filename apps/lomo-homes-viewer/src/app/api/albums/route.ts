import type { NextRequest } from 'next/server';
import { execFileSync } from 'child_process';
import { join } from 'path';
import { extractUsername } from '../photos/route';

export interface AlbumEntry {
  albumId: string;
  albumPage: string;
  coverImage: string;
  title: string;
}

function fetchAlbums(username: string): {
  albums: AlbumEntry[];
  albumCount: number;
  rateLimited?: boolean;
} {
  const scriptPath = join(process.cwd(), 'scripts', 'fetch_albums.py');

  try {
    const output = execFileSync('python3', [scriptPath, username, '--quick'], {
      timeout: 30_000,
      encoding: 'utf-8',
      maxBuffer: 50 * 1024 * 1024,
    });

    const result = JSON.parse(output);
    return {
      albums: result.albums || [],
      albumCount: result.albumCount || 0,
      rateLimited: result.rateLimited || false,
    };
  } catch (error) {
    console.error('Error running fetch_albums.py:', error);
    return { albums: [], albumCount: 0, rateLimited: false };
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const input = searchParams.get('input');

  if (!input) {
    return Response.json({ error: 'No input provided' }, { status: 400 });
  }

  const username = extractUsername(input);

  if (!username) {
    return Response.json({ error: 'Invalid username or URL' }, { status: 400 });
  }

  try {
    console.log(`Fetching albums for user ${username}...`);
    const result = fetchAlbums(username);

    if (result.rateLimited) {
      return Response.json(
        { error: 'Rate limited by Lomography. Please try again later.', albums: result.albums },
        { status: 429 }
      );
    }

    console.log(`Found ${result.albumCount} albums for user ${username}`);
    return Response.json({
      username,
      albumCount: result.albumCount,
      albums: result.albums,
    });
  } catch (error) {
    console.error('Error fetching albums:', error);
    return Response.json({ error: 'Failed to fetch albums' }, { status: 500 });
  }
}
