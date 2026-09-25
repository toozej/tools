import type { PhotoBatch, PhotoEntry } from './sources';
import { safeImageUrl } from './sources';

export class SourceError extends Error {
  constructor(message: string, public status = 502) {
    super(message);
  }
}

async function getJson(url: URL, headers?: HeadersInit): Promise<unknown> {
  const response = await fetch(url, {
    headers,
    signal: AbortSignal.timeout(15000),
    next: { revalidate: 60 },
  });
  if (!response.ok) {
    throw new SourceError(`Photo source returned HTTP ${response.status}.`, response.status === 429 ? 429 : 502);
  }
  return response.json();
}

let redditToken: { value: string; expires: number } | null = null;

async function getRedditToken(): Promise<string> {
  const id = process.env.REDDIT_CLIENT_ID;
  const secret = process.env.REDDIT_CLIENT_SECRET;
  const agent = process.env.REDDIT_USER_AGENT;
  if (!id || !secret || !agent) {
    throw new SourceError('Set REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET, and REDDIT_USER_AGENT to use Reddit.', 503);
  }
  if (redditToken && redditToken.expires > Date.now() + 60000) return redditToken.value;
  const response = await fetch('https://www.reddit.com/api/v1/access_token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': agent,
    },
    body: 'grant_type=client_credentials',
    cache: 'no-store',
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new SourceError(`Reddit authentication returned HTTP ${response.status}.`);
  const data = await response.json();
  if (!data.access_token) throw new SourceError('Reddit did not return an access token.');
  redditToken = { value: data.access_token, expires: Date.now() + Number(data.expires_in ?? 3600) * 1000 };
  return redditToken.value;
}

type RedditMedia = { s?: { u?: string }; status?: string; m?: string };
type RedditPost = {
  id?: string;
  title?: string;
  permalink?: string;
  post_hint?: string;
  url?: string;
  is_video?: boolean;
  over_18?: boolean;
  media_metadata?: Record<string, RedditMedia>;
  gallery_data?: { items?: { media_id: string }[] };
  preview?: { images?: { source?: { url?: string }; resolutions?: { url?: string }[] }[] };
};

function redditImages(post: RedditPost): PhotoEntry[] {
  if (post.over_18 || post.is_video || !post.id) return [];
  const page = post.permalink?.startsWith('/') ? `https://www.reddit.com${post.permalink}` : `https://www.reddit.com/comments/${post.id}`;
  const gallery = post.gallery_data?.items ?? [];
  if (gallery.length) {
    return gallery.flatMap((item, index) => {
      const media = post.media_metadata?.[item.media_id];
      if (!media || media.status !== 'valid' || !media.m?.startsWith('image/')) return [];
      const fullsize = safeImageUrl(media.s?.u?.replaceAll('&amp;', '&'));
      if (!fullsize) return [];
      return [{ thumbnail: fullsize, fullsize, photoPage: `${page}#image-${index + 1}`, title: post.title, source: 'reddit' as const }];
    });
  }
  const direct = safeImageUrl(post.url?.replaceAll('&amp;', '&'));
  const directHost = direct ? new URL(direct).hostname : '';
  const previewFullsize = safeImageUrl(post.preview?.images?.[0]?.source?.url?.replaceAll('&amp;', '&'));
  const fullsize = ['i.redd.it', 'i.imgur.com', 'preview.redd.it'].includes(directHost) ? direct : previewFullsize;
  if (!fullsize || !/\.(?:jpe?g|png|webp)(?:$|\?)/i.test(fullsize)) return [];
  const preview = post.preview?.images?.[0];
  const thumbnail = safeImageUrl(preview?.resolutions?.at(-1)?.url?.replaceAll('&amp;', '&')) ?? fullsize;
  return [{ thumbnail, fullsize, photoPage: page, title: post.title, source: 'reddit' }];
}

export async function fetchReddit(subredditInput: string, cursor: string | null): Promise<PhotoBatch> {
  const subreddit = subredditInput.trim().replace(/^r\//i, '');
  if (!/^[A-Za-z0-9_]{2,21}$/.test(subreddit)) throw new SourceError('Enter a valid subreddit name.', 400);
  if (cursor && !/^t3_[a-z0-9]+$/.test(cursor)) throw new SourceError('Invalid Reddit cursor.', 400);
  const token = await getRedditToken();
  const url = new URL(`https://oauth.reddit.com/r/${subreddit}/new`);
  url.searchParams.set('limit', '50');
  url.searchParams.set('raw_json', '1');
  if (cursor) url.searchParams.set('after', cursor);
  const data = await getJson(url, {
    Authorization: `Bearer ${token}`,
    'User-Agent': process.env.REDDIT_USER_AGENT!,
  }) as { data?: { after?: string | null; children?: { data: RedditPost }[] } };
  const images = (data.data?.children ?? []).flatMap((child) => redditImages(child.data));
  return { images, nextCursor: data.data?.after ?? null, hasMore: Boolean(data.data?.after) };
}

export async function fetchFlickr(query: string, cursor: string | null): Promise<PhotoBatch> {
  const key = process.env.FLICKR_API_KEY;
  if (!key) throw new SourceError('Set FLICKR_API_KEY to use Flickr.', 503);
  if (!query.trim() || query.length > 200) throw new SourceError('Enter a Flickr search with 1 to 200 characters.', 400);
  const page = cursor ? Number(cursor) : 1;
  if (!Number.isSafeInteger(page) || page < 1 || page > 1000) throw new SourceError('Invalid Flickr cursor.', 400);
  const url = new URL('https://api.flickr.com/services/rest/');
  for (const [name, value] of Object.entries({
    method: 'flickr.photos.search', api_key: key, text: query.trim(), format: 'json', nojsoncallback: '1',
    extras: 'url_q,url_c,url_l,url_o', media: 'photos', safe_search: '1', per_page: '40', page: String(page),
  })) url.searchParams.set(name, value);
  const data = await getJson(url) as {
    stat?: string; message?: string;
    photos?: { pages?: number; photo?: { id: string; owner: string; title?: string; url_q?: string; url_c?: string; url_l?: string; url_o?: string }[] };
  };
  if (data.stat !== 'ok') throw new SourceError(data.message ?? 'Flickr could not load photos.');
  const images = (data.photos?.photo ?? []).flatMap((photo) => {
    const fullsize = safeImageUrl(photo.url_o ?? photo.url_l ?? photo.url_c);
    const thumbnail = safeImageUrl(photo.url_q ?? photo.url_c ?? photo.url_l);
    if (!fullsize || !thumbnail) return [];
    return [{ thumbnail, fullsize, photoPage: `https://www.flickr.com/photos/${encodeURIComponent(photo.owner)}/${encodeURIComponent(photo.id)}`, title: photo.title, source: 'flickr' as const }];
  });
  const hasMore = page < (data.photos?.pages ?? 0);
  return { images, nextCursor: hasMore ? String(page + 1) : null, hasMore };
}

type ImgurImage = { id?: string; link?: string; type?: string; title?: string; nsfw?: boolean };
type ImgurItem = ImgurImage & { is_album?: boolean; images?: ImgurImage[] };

export async function fetchImgur(query: string, cursor: string | null): Promise<PhotoBatch> {
  const clientId = process.env.IMGUR_CLIENT_ID;
  if (!clientId) throw new SourceError('Set IMGUR_CLIENT_ID to use Imgur.', 503);
  if (!query.trim() || query.length > 200) throw new SourceError('Enter an Imgur search with 1 to 200 characters.', 400);
  const page = cursor ? Number(cursor) : 0;
  if (!Number.isSafeInteger(page) || page < 0 || page > 1000) throw new SourceError('Invalid Imgur cursor.', 400);
  const url = new URL(`https://api.imgur.com/3/gallery/search/time/${page}`);
  url.searchParams.set('q', query.trim());
  const data = await getJson(url, { Authorization: `Client-ID ${clientId}` }) as { success?: boolean; data?: ImgurItem[] };
  if (!data.success || !Array.isArray(data.data)) throw new SourceError('Imgur could not load photos.');
  const images = data.data.flatMap((item) => {
    if (item.nsfw) return [];
    const photos = item.is_album ? item.images ?? [] : [item];
    return photos.flatMap((photo) => {
      if (photo.nsfw || !photo.type?.startsWith('image/') || photo.type === 'image/gif') return [];
      const fullsize = safeImageUrl(photo.link);
      if (!fullsize) return [];
      return [{ thumbnail: fullsize, fullsize, photoPage: `https://imgur.com/${item.is_album ? 'a/' : ''}${item.id ?? photo.id}`, title: photo.title ?? item.title, source: 'imgur' as const }];
    });
  });
  const hasMore = data.data.length > 0;
  return { images, nextCursor: hasMore ? String(page + 1) : null, hasMore };
}
