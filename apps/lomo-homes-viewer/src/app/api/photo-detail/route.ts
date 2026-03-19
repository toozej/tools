import type { NextRequest } from 'next/server';
import { execFileSync } from 'child_process';
import { join } from 'path';

const PHOTO_PATH_RE = /^\/homes\/[a-zA-Z0-9_-]+\/photos\/\d+/;

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
      timeout: 30_000,
      encoding: 'utf-8',
    });

    const result = JSON.parse(output);
    return Response.json({ fullsize: result.fullsize ?? null });
  } catch (error) {
    console.error('Error running fetch_photo_detail.py:', error);
    return Response.json({ fullsize: null });
  }
}
