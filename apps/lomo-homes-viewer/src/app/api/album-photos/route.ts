import type { NextRequest } from 'next/server';
import { execFileSync } from 'child_process';
import { join } from 'path';
import { extractUsername } from '../photos/route';

export interface AlbumPhotoEntry {
  thumbnail: string;
  photoPage: string;
  fullsize?: string;
}

function fetchAlbumPhotos(
  username: string,
  albumId: string,
  startPage: number,
  endPage: number
): {
  images: AlbumPhotoEntry[];
  imageCount: number;
  pagesScanned: number;
  rateLimited?: boolean;
} {
  const scriptPath = join(process.cwd(), 'scripts', 'fetch_album_photos.py');

  try {
    const output = execFileSync(
      'python3',
      [scriptPath, username, albumId, String(startPage), String(endPage), '--quick'],
      {
        timeout: 30_000,
        encoding: 'utf-8',
        maxBuffer: 50 * 1024 * 1024,
      }
    );

    const result = JSON.parse(output);
    return {
      images: result.images || [],
      imageCount: result.imageCount || 0,
      pagesScanned: result.pagesScanned || 0,
      rateLimited: result.rateLimited || false,
    };
  } catch (error) {
    console.error('Error running fetch_album_photos.py:', error);
    return { images: [], imageCount: 0, pagesScanned: 0, rateLimited: false };
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const input = searchParams.get('input');
  const albumId = searchParams.get('albumId');
  const pageParam = searchParams.get('page');

  if (!input) {
    return Response.json({ error: 'No input provided' }, { status: 400 });
  }

  if (!albumId || !/^\d+(?:-[\w-]+)?$/.test(albumId)) {
    return Response.json({ error: 'Invalid albumId' }, { status: 400 });
  }

  const username = extractUsername(input);

  if (!username) {
    return Response.json({ error: 'Invalid username or URL' }, { status: 400 });
  }

  const page = pageParam ? parseInt(pageParam, 10) : 1;
  if (isNaN(page) || page < 1) {
    return Response.json({ error: 'Invalid page number' }, { status: 400 });
  }

  const batchParam = searchParams.get('batchSize');
  const batchSize = Math.min(Math.max(parseInt(batchParam ?? '8', 10) || 8, 1), 10);
  const startPage = page;
  const endPage = page + batchSize - 1;

  try {
    console.log(
      `Fetching album ${albumId} pages ${startPage}-${endPage} for user ${username}...`
    );
    const result = fetchAlbumPhotos(username, albumId, startPage, endPage);

    if (result.rateLimited) {
      return Response.json(
        { error: 'Rate limited by Lomography. Please try again later.', images: result.images },
        { status: 429 }
      );
    }

    console.log(
      `Found ${result.imageCount} images across ${result.pagesScanned} pages in album ${albumId}`
    );
    return Response.json({
      username,
      albumId,
      startPage,
      endPage,
      pagesScanned: result.pagesScanned,
      imageCount: result.imageCount,
      images: result.images,
      hasMore: result.pagesScanned >= batchSize,
    });
  } catch (error) {
    console.error('Error fetching album photos:', error);
    return Response.json({ error: 'Failed to fetch album photos' }, { status: 500 });
  }
}
