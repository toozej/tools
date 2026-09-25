export type PhotoSource = 'lomography' | 'reddit' | 'flickr' | 'imgur';

export interface PhotoEntry {
  thumbnail: string;
  photoPage: string;
  fullsize?: string;
  title?: string;
  source?: PhotoSource;
}

export interface PhotoBatch {
  images: PhotoEntry[];
  nextCursor: string | null;
  hasMore: boolean;
}

export const SOURCE_OPTIONS: { id: PhotoSource; label: string; placeholder: string; inputLabel: string; defaultInput: string }[] = [
  { id: 'lomography', label: 'Lomography', placeholder: 'Username or Lomography home URL', inputLabel: 'Artist', defaultInput: '' },
  { id: 'reddit', label: 'Reddit', placeholder: 'analog', inputLabel: 'Subreddit', defaultInput: 'analog' },
  { id: 'flickr', label: 'Flickr', placeholder: 'film photography', inputLabel: 'Search photos', defaultInput: 'film photography' },
  { id: 'imgur', label: 'Imgur', placeholder: 'photography', inputLabel: 'Search gallery', defaultInput: 'photography' },
];

export function isPhotoSource(value: string | null): value is PhotoSource {
  return SOURCE_OPTIONS.some((option) => option.id === value);
}

export function safeImageUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}
