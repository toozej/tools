import { afterEach, describe, expect, test, vi } from 'vitest';
import type { NextRequest } from 'next/server';
import { GET } from './route';

function request(url: string): NextRequest {
  return { nextUrl: new URL(`https://viewer.example/api/download?url=${encodeURIComponent(url)}`) } as NextRequest;
}

afterEach(() => vi.unstubAllGlobals());

describe('photo download', () => {
  test('rejects an untrusted image host before fetch', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const response = await GET(request('https://example.com/private.jpg'));
    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('serves a full size image as a download', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'image/jpeg' } })));
    const response = await GET(request('https://i.redd.it/photo.jpg'));
    expect(response.status).toBe(200);
    expect(response.headers.get('content-disposition')).toContain('attachment');
    expect(await response.arrayBuffer()).toEqual(new Uint8Array([1, 2, 3]).buffer);
  });
});
