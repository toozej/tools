import type { NextRequest } from 'next/server';

const HOSTS = [
  'cdn.assets.lomography.com',
  'i.redd.it',
  'preview.redd.it',
  'i.imgur.com',
];

function allowedHost(hostname: string): boolean {
  return HOSTS.includes(hostname) || hostname === 'staticflickr.com' || hostname.endsWith('.staticflickr.com');
}

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get('url');
  if (!raw) return Response.json({ error: 'Missing image URL.' }, { status: 400 });
  let imageUrl: URL;
  try {
    imageUrl = new URL(raw);
  } catch {
    return Response.json({ error: 'Invalid image URL.' }, { status: 400 });
  }
  if (imageUrl.protocol !== 'https:' || !allowedHost(imageUrl.hostname) || imageUrl.port || imageUrl.username || imageUrl.password) {
    return Response.json({ error: 'Image host is not allowed.' }, { status: 400 });
  }
  try {
    const upstream = await fetch(imageUrl, { redirect: 'manual', signal: AbortSignal.timeout(30000), cache: 'no-store' });
    if (!upstream.ok || !upstream.body) return Response.json({ error: 'Image download failed.' }, { status: 502 });
    const type = upstream.headers.get('content-type')?.split(';')[0].trim() ?? '';
    const extensions: Record<string, string> = {
      'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp',
      'image/avif': 'avif', 'image/gif': 'gif',
    };
    if (!extensions[type]) return Response.json({ error: 'The source did not return an image.' }, { status: 502 });
    const length = Number(upstream.headers.get('content-length'));
    if (length > 50 * 1024 * 1024) return Response.json({ error: 'Image exceeds the 50 MB download limit.' }, { status: 413 });
    return new Response(upstream.body, {
      headers: {
        'Content-Type': type,
        'Content-Disposition': `attachment; filename="photo.${extensions[type]}"`,
        'Cache-Control': 'private, max-age=600',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return Response.json({ error: 'Image download failed.' }, { status: 502 });
  }
}
