import type { NextRequest } from 'next/server';
import { execFileSync } from 'child_process';
import { join } from 'path';

const PHOTO_PATH_RE = /^\/homes\/[a-zA-Z0-9_-]+\/(?:photos|albums\/[\w-]+)\/\d+/;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const photoPage = searchParams.get('photoPage');

  if (!photoPage || !PHOTO_PATH_RE.test(photoPage)) {
    return Response.json(
      { error: 'Invalid or missing photoPage parameter' },
      { status: 400 }
    );
  }

  const scriptPath = join(process.cwd(), 'scripts', 'fetch_photo_detail.py');

  try {
    const output = execFileSync('python3', [scriptPath, photoPage], {
      timeout: 90_000,
      encoding: 'utf-8',
    });

    const result = JSON.parse(output);
    if (result.error) {
      return Response.json(
        { error: `Unable to fetch Lomography photo detail: ${result.error}`, fullsize: null },
        { status: 502 }
      );
    }
    return Response.json({ fullsize: result.fullsize ?? null });
  } catch (error) {
    console.error('Error running fetch_photo_detail.py:', error);
    return Response.json({ fullsize: null });
  }
}
