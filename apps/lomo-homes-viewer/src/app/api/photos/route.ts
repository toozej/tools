import type { NextRequest } from 'next/server';
import { execFileSync } from 'child_process';
import { join } from 'path';

// Helper to extract username from URL or plain string
export function extractUsername(input: string): string | null {
  const trimmed = input.trim();

  // Return null for empty input
  if (!trimmed) {
    return null;
  }

  // Check if it's a lomography URL first
  try {
    const url = new URL(trimmed);
    // Only process lomography.com domains
    if (url.hostname.includes('lomography.com')) {
      const pathSegments = url.pathname.split('/').filter(Boolean);

      // Look for the pattern: /homes/username/...
      const homesIndex = pathSegments.findIndex(seg => seg === 'homes');
      if (homesIndex !== -1 && pathSegments[homesIndex + 1]) {
        return pathSegments[homesIndex + 1];
      }
    }
  } catch (error) {
    // Not a valid URL, check if it might contain a lomography homes path
    const match = trimmed.match(/https?:\/\/[^/]*lomography\.com\/(?:[^/]*\/)*homes\/([a-zA-Z0-9_-]+)/);
    if (match) {
      return match[1];
    }
  }

  // If it's already a username (no slashes, dots, and contains at least one letter or number)
  // But only if it doesn't look like a URL or path, and has reasonable username structure
  if (!trimmed.includes('/') && !trimmed.includes('.') && /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(trimmed)) {
    const parts = trimmed.split(/[-_]/);
    if (parts.length <= 3) {
      return trimmed;
    }
  }

  // Handle partial paths like "homes/aciano/photos" or paths with other segments before homes
  const pathMatch = trimmed.match(/(?:^|\/)(?:[^/]*\/)*homes\/([a-zA-Z0-9_-]+)/);
  if (pathMatch) {
    return pathMatch[1];
  }

  return null;
}

export interface PhotoEntry {
  thumbnail: string;
  photoPage: string;
  fullsize?: string;
}

// Fetch a page range using the async Python script.
// Cloudflare blocks Node.js/Bun fetch but allows Python's aiohttp.
function fetchPhotos(username: string, startPage: number, endPage: number): {
  images: PhotoEntry[];
  imageCount: number;
  pagesScanned: number;
  rateLimited?: boolean;
} {
  const scriptPath = join(process.cwd(), 'scripts', 'fetch_photos.py');

  try {
    const output = execFileSync(
      'python3',
      [scriptPath, username, String(startPage), String(endPage), '--quick'],
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
    console.error('Error running fetch_photos.py:', error);
    return { images: [], imageCount: 0, pagesScanned: 0, rateLimited: false };
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const input = searchParams.get('input');
  const pageParam = searchParams.get('page');

  if (!input) {
    return Response.json({ error: 'No input provided' }, { status: 400 });
  }

  const username = extractUsername(input);

  if (!username) {
    return Response.json({ error: 'Invalid username or URL' }, { status: 400 });
  }

  const page = pageParam ? parseInt(pageParam, 10) : 1;
  if (isNaN(page) || page < 1) {
    return Response.json({ error: 'Invalid page number' }, { status: 400 });
  }

  // Batch size can be overridden by the client (grid uses 4, feed uses 8).
  const batchParam = searchParams.get('batchSize');
  const batchSize = Math.min(Math.max(parseInt(batchParam ?? '8', 10) || 8, 1), 10);
  const startPage = page;
  const endPage = page + batchSize - 1;

  try {
    console.log(`Fetching pages ${startPage}-${endPage} for user ${username}...`);
    const result = fetchPhotos(username, startPage, endPage);

    if (result.rateLimited) {
      return Response.json(
        { error: 'Rate limited by Lomography. Please try again later.', images: result.images },
        { status: 429 }
      );
    }

    console.log(
      `Found ${result.imageCount} images across ${result.pagesScanned} pages for user ${username}`
    );
    return Response.json({
      username,
      startPage,
      endPage,
      pagesScanned: result.pagesScanned,
      imageCount: result.imageCount,
      images: result.images,
      hasMore: result.pagesScanned >= batchSize,
    });
  } catch (error) {
    console.error('Error fetching photos:', error);
    return Response.json({ error: 'Failed to fetch photos' }, { status: 500 });
  }
}
