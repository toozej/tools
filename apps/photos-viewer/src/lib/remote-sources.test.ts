import { afterEach, describe, expect, test, vi } from 'vitest';
import { fetchFlickr, fetchImgur, fetchReddit } from './remote-sources';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('remote photo sources', () => {
  test('Reddit follows its listing cursor and includes gallery images', async () => {
    vi.stubEnv('REDDIT_CLIENT_ID', 'client');
    vi.stubEnv('REDDIT_CLIENT_SECRET', 'secret');
    vi.stubEnv('REDDIT_USER_AGENT', 'web:photos-viewer:test (by /u/example)');
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'token', expires_in: 3600 }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: { after: 't3_next', children: [
        { data: { id: 'abc', title: 'Gallery', permalink: '/r/analog/comments/abc/gallery/', gallery_data: { items: [{ media_id: 'one' }] }, media_metadata: { one: { status: 'valid', m: 'image/jpeg', s: { u: 'https://preview.redd.it/one.jpg?width=200&amp;format=pjpg' } } } } },
        { data: { id: 'hidden', over_18: true, url: 'https://i.redd.it/hidden.jpg' } },
      ] } }) });
    vi.stubGlobal('fetch', fetchMock);
    const batch = await fetchReddit('r/analog', null);
    expect(batch.images).toHaveLength(1);
    expect(batch.images[0].fullsize).toContain('&format=pjpg');
    expect(batch.nextCursor).toBe('t3_next');
    expect(String(fetchMock.mock.calls[1][0])).toContain('/r/analog/new');
  });

  test('Flickr maps image sizes and page count', async () => {
    vi.stubEnv('FLICKR_API_KEY', 'key');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ stat: 'ok', photos: { pages: 2, photo: [{ id: '123', owner: 'owner', title: 'Frame', url_q: 'https://live.staticflickr.com/q.jpg', url_l: 'https://live.staticflickr.com/l.jpg' }] } }) }));
    const batch = await fetchFlickr('film', null);
    expect(batch.images[0].thumbnail).toBe('https://live.staticflickr.com/q.jpg');
    expect(batch.images[0].fullsize).toBe('https://live.staticflickr.com/l.jpg');
    expect(batch.nextCursor).toBe('2');
  });

  test('Imgur expands albums and skips nonphotos', async () => {
    vi.stubEnv('IMGUR_CLIENT_ID', 'client');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true, data: [
      { id: 'album', is_album: true, images: [{ id: 'one', type: 'image/jpeg', link: 'https://i.imgur.com/one.jpg' }, { id: 'two', type: 'video/mp4', link: 'https://i.imgur.com/two.mp4' }] },
      { id: 'hidden', nsfw: true, type: 'image/jpeg', link: 'https://i.imgur.com/hidden.jpg' },
    ] }) }));
    const batch = await fetchImgur('photography', null);
    expect(batch.images).toHaveLength(1);
    expect(batch.images[0].photoPage).toBe('https://imgur.com/a/album');
    expect(batch.nextCursor).toBe('1');
  });
});
