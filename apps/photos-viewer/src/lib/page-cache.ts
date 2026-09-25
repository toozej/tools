import type { PhotoBatch, PhotoSource } from './sources';

const TTL = 10 * 60 * 1000;
const PREFIX = 'photos-viewer:v1:';

export function cacheKey(source: PhotoSource, input: string, cursor: string | null): string {
  return `${PREFIX}${JSON.stringify([source, input.trim().toLowerCase(), cursor])}`;
}

export function readCachedBatch(key: string): PhotoBatch | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const entry = JSON.parse(raw) as { expires: number; batch: PhotoBatch };
    if (entry.expires > Date.now() && Array.isArray(entry.batch.images)) return entry.batch;
    localStorage.removeItem(key);
  } catch {
    // Browsers can disable local storage.
  }
  return null;
}

export function writeCachedBatch(key: string, batch: PhotoBatch): void {
  try {
    localStorage.setItem(key, JSON.stringify({ expires: Date.now() + TTL, batch }));
  } catch {
    // The viewer still works if storage is full or disabled.
  }
}

export function clearCachedSource(source: PhotoSource, input: string): void {
  try {
    const prefix = `${PREFIX}${JSON.stringify([source, input.trim().toLowerCase()]).slice(0, -1)},`;
    for (let index = localStorage.length - 1; index >= 0; index--) {
      const key = localStorage.key(index);
      if (key?.startsWith(prefix)) localStorage.removeItem(key);
    }
  } catch {
    // Browsers can disable local storage.
  }
}
