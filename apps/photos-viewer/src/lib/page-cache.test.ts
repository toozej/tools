import { beforeEach, describe, expect, test, vi } from 'vitest';
import { cacheKey, clearCachedSource, readCachedBatch, writeCachedBatch } from './page-cache';

const batch = { images: [{ thumbnail: 'https://i.redd.it/a.jpg', photoPage: 'https://reddit.com/a' }], nextCursor: 't3_next', hasMore: true };

beforeEach(() => localStorage.clear());

describe('photo page cache', () => {
  test('reuses a saved page and clears only the selected source', () => {
    const reddit = cacheKey('reddit', 'analog', null);
    const flickr = cacheKey('flickr', 'analog', null);
    writeCachedBatch(reddit, batch);
    writeCachedBatch(flickr, batch);
    expect(readCachedBatch(reddit)).toEqual(batch);
    clearCachedSource('reddit', 'analog');
    expect(readCachedBatch(reddit)).toBeNull();
    expect(readCachedBatch(flickr)).toEqual(batch);
  });

  test('discards an expired page', () => {
    const key = cacheKey('reddit', 'analog', null);
    writeCachedBatch(key, batch);
    vi.useFakeTimers();
    vi.advanceTimersByTime(11 * 60 * 1000);
    expect(readCachedBatch(key)).toBeNull();
    vi.useRealTimers();
  });
});
