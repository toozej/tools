'use client';

import { useState, useEffect, useRef, useCallback, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { PhotoEntry, PhotoBatch, PhotoSource } from '@/lib/sources';
import { SOURCE_OPTIONS, isPhotoSource } from '@/lib/sources';
import { cacheKey, clearCachedSource, readCachedBatch, writeCachedBatch } from '@/lib/page-cache';
import { ImageWithRetry, FeedImage, Lightbox, ViewModeToggle, useFullsizeResolver } from '../components/shared';

const KNOWN_ARTISTS = [
  'aciano', 'rik041', 'sirio174', 'mylatehope', 'adi_totp', 'lomodesbro',
  'anelace', 'lomovanrenier', 'dearjme', 'yoavcoren', 'neanderthalis',
  'vikk', 'bravopires', 'herbert-4',
];

function featuredArtist(): string {
  const now = new Date();
  const key = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
  let hash = 0;
  for (const char of key) hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0;
  return KNOWN_ARTISTS[Math.abs(hash) % KNOWN_ARTISTS.length];
}

function artistName(input: string): string {
  return input.match(/(?:^|\/)homes\/([A-Za-z0-9_-]+)/)?.[1] ?? input;
}

export default function Home() {
  return <Suspense fallback={<div className="min-h-screen bg-neutral-900" />}><HomeInner /></Suspense>;
}

type Search = { source: PhotoSource; input: string; id: number };

function HomeInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialSource = isPhotoSource(searchParams.get('source')) ? searchParams.get('source') as PhotoSource : 'lomography';
  const initialInput = searchParams.get('input') ?? '';
  const [source, setSource] = useState<PhotoSource>(initialSource);
  const [input, setInput] = useState(initialInput || SOURCE_OPTIONS.find((item) => item.id === initialSource)!.defaultInput);
  const [search, setSearch] = useState<Search | null>(initialInput ? { source: initialSource, input: initialInput, id: 0 } : null);
  const [images, setImages] = useState<PhotoEntry[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'feed'>('feed');
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const { fullsizeUrls, resolveFullsize, clearFullsize } = useFullsizeResolver();
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadFnRef = useRef<() => Promise<void>>(async () => {});
  const loadingRef = useRef(false);
  const generationRef = useRef(0);
  const searchIdRef = useRef(0);
  const skipCacheRef = useRef(false);

  const option = useMemo(() => SOURCE_OPTIONS.find((item) => item.id === source)!, [source]);

  const loadNextBatch = useCallback(async () => {
    if (!search || loadingRef.current || !hasMore) return;
    loadingRef.current = true;
    setLoading(true);
    const generation = generationRef.current;
    const key = cacheKey(search.source, search.input, cursor);
    try {
      let batch = skipCacheRef.current ? null : readCachedBatch(key);
      if (!batch) {
        const params = new URLSearchParams({ source: search.source, input: search.input, batchSize: viewMode === 'grid' ? '4' : '8' });
        if (cursor) params.set('cursor', cursor);
        if (search.source === 'lomography') params.set('page', cursor ?? '1');
        const response = await fetch(`/photos-viewer/api/photos?${params}`);
        const data = await response.json();
        if (!response.ok || data.error) throw new Error(data.error ?? `Photo source returned HTTP ${response.status}.`);
        batch = data as PhotoBatch;
        writeCachedBatch(key, batch);
      }
      if (generation !== generationRef.current) return;
      setImages((previous) => {
        const known = new Set(previous.map((photo) => photo.photoPage));
        return [...previous, ...batch.images.filter((photo) => !known.has(photo.photoPage))];
      });
      setCursor(batch.nextCursor);
      setHasMore(batch.hasMore && !!batch.nextCursor);
      setError(null);
    } catch (cause) {
      if (generation === generationRef.current) {
        setError(cause instanceof Error ? cause.message : 'Unable to load photos.');
        setHasMore(false);
      }
    } finally {
      if (generation === generationRef.current) {
        loadingRef.current = false;
        setLoading(false);
      }
    }
  }, [search, hasMore, cursor, viewMode]);

  useEffect(() => { loadFnRef.current = loadNextBatch; }, [loadNextBatch]);
  useEffect(() => { if (search) loadFnRef.current(); }, [search]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !search) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) loadFnRef.current();
    }, { rootMargin: '600px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, [search]);

  function startSearch(nextSource: PhotoSource, nextInput: string, refresh = false) {
    const normalized = nextInput.trim();
    if (!normalized) return;
    if (refresh) clearCachedSource(nextSource, normalized);
    skipCacheRef.current = refresh;
    generationRef.current++;
    loadingRef.current = false;
    searchIdRef.current++;
    setSource(nextSource);
    setInput(normalized);
    setImages([]);
    setCursor(null);
    setHasMore(true);
    setLoading(false);
    setError(null);
    clearFullsize();
    setSearch({ source: nextSource, input: normalized, id: searchIdRef.current });
    const params = new URLSearchParams({ input: normalized });
    if (nextSource !== 'lomography') params.set('source', nextSource);
    router.push(`/?${params}`);
  }

  function changeSource(next: PhotoSource) {
    generationRef.current++;
    loadingRef.current = false;
    setSource(next);
    setInput(SOURCE_OPTIONS.find((item) => item.id === next)!.defaultInput);
    setSearch(null);
    setImages([]);
    setCursor(null);
    setHasMore(true);
    setError(null);
    clearFullsize();
    router.push(next === 'lomography' ? '/' : `/?source=${next}`);
  }

  function openLightbox(index: number) {
    setLightboxIndex(index);
    resolveFullsize(images[index]);
  }

  return (
    <main className="min-h-screen bg-neutral-900 text-white">
      <header className="bg-neutral-800 border-b border-neutral-700 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-4 flex items-center justify-between gap-2">
          <h1 className="text-lg sm:text-xl font-semibold">Photos Viewer</h1>
          <div className="flex items-center gap-2">
            {search?.source === 'lomography' && images.length > 0 && (
              <button onClick={() => router.push(`/artist/${encodeURIComponent(artistName(search.input))}`)} className="px-3 py-1.5 bg-neutral-600 hover:bg-neutral-500 rounded-md text-sm">View Albums</button>
            )}
            {images.length > 0 && <ViewModeToggle viewMode={viewMode} onSetViewMode={setViewMode} />}
          </div>
        </div>
      </header>

      <section className="bg-neutral-800 border-b border-neutral-700 py-6 sm:py-8">
        <div className="max-w-3xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="bg-neutral-700 rounded-lg p-4 sm:p-6 shadow-lg">
            <h2 className="text-base sm:text-lg font-medium mb-4 text-neutral-200">Discover photos</h2>
            <label htmlFor="photo-source" className="block text-sm font-medium mb-2 text-neutral-300">Source</label>
            <select id="photo-source" value={source} onChange={(event) => changeSource(event.target.value as PhotoSource)} className="w-full px-4 py-2.5 mb-4 bg-neutral-600 border border-neutral-500 rounded-md text-white">
              {SOURCE_OPTIONS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
            {source === 'lomography' && (
              <div className="flex flex-wrap gap-2 sm:gap-3 mb-4">
                <button onClick={() => startSearch('lomography', KNOWN_ARTISTS[Math.floor(Math.random() * KNOWN_ARTISTS.length)])} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-md text-sm font-medium">🎲 Random Artist</button>
                <button onClick={() => startSearch('lomography', featuredArtist())} className="px-4 py-2 bg-amber-600 hover:bg-amber-700 rounded-md text-sm font-medium">⭐ Featured Today</button>
              </div>
            )}
            {source === 'reddit' && <div className="flex flex-wrap gap-2 mb-4">{['analog', 'photography', 'filmphotography'].map((name) => <button key={name} onClick={() => startSearch('reddit', name)} className="px-3 py-1.5 bg-neutral-600 hover:bg-neutral-500 rounded-md text-sm">r/{name}</button>)}</div>}
            <label htmlFor="photo-input" className="block text-sm font-medium mb-2 text-neutral-300">{option.inputLabel}</label>
            <div className="flex flex-col sm:flex-row gap-3">
              <input id="photo-input" type="text" value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') startSearch(source, input); }} placeholder={option.placeholder} className="flex-1 px-4 py-2.5 sm:py-2 bg-neutral-600 border border-neutral-500 rounded-md text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-base" />
              <button onClick={() => startSearch(source, input)} disabled={loading || !input.trim()} className="px-6 py-2.5 sm:py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-md font-medium whitespace-nowrap">{loading ? 'Loading...' : 'Load Photos'}</button>
            </div>
            {error && <div role="alert" className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-md text-red-300 text-sm">{error}</div>}
          </div>
        </div>
      </section>

      <section className="py-6 sm:py-8">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          {images.length === 0 && !loading && !error && <div className="text-center py-16"><div className="text-6xl mb-4 opacity-20">📷</div><h3 className="text-xl font-medium text-neutral-300 mb-2">No photos loaded</h3><p className="text-neutral-400">Choose a source and load photos.</p></div>}
          {images.length > 0 && <div className="mb-6 flex items-center justify-between gap-3"><h2 className="text-xl font-semibold">{images.length} Photos</h2><div className="flex items-center gap-3 text-sm text-neutral-400"><span>{loading ? 'Loading more...' : hasMore ? 'Scroll for more' : 'End of photos'}</span><button onClick={() => startSearch(search!.source, search!.input, true)} className="text-blue-300 hover:text-white">Refresh</button></div></div>}
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-4">
              {images.map((photo, index) => <button key={photo.photoPage} type="button" className="aspect-square rounded-lg overflow-hidden bg-neutral-700 transition-transform hover:scale-105" onClick={() => openLightbox(index)} aria-label={`Open ${photo.title ?? `photo ${index + 1}`}`}><ImageWithRetry src={photo.thumbnail} alt={photo.title ?? `Photo ${index + 1}`} className="w-full h-full object-cover" loading="lazy" /></button>)}
            </div>
          ) : (
            <div className="max-w-4xl mx-auto space-y-4">
              {images.map((photo, index) => <FeedImage key={photo.photoPage} img={photo} index={index} fullsizeUrl={fullsizeUrls.get(photo.photoPage) ?? photo.fullsize} onClick={() => openLightbox(index)} onResolveFullsize={resolveFullsize} />)}
            </div>
          )}
          {search && hasMore && <div ref={sentinelRef} className="h-4" aria-hidden="true" />}
          {loading && <div className="flex items-center justify-center gap-2 py-6 text-neutral-400"><div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-neutral-400" />Loading photos...</div>}
        </div>
      </section>

      {lightboxIndex !== null && images[lightboxIndex] && <Lightbox images={images} lightboxIndex={lightboxIndex} fullsizeUrls={fullsizeUrls} onClose={() => setLightboxIndex(null)} onPrev={() => { const next = (lightboxIndex - 1 + images.length) % images.length; setLightboxIndex(next); resolveFullsize(images[next]); }} onNext={() => { const next = (lightboxIndex + 1) % images.length; setLightboxIndex(next); resolveFullsize(images[next]); }} getImageUrl={(photo) => fullsizeUrls.get(photo.photoPage) ?? photo.fullsize ?? photo.thumbnail} />}
    </main>
  );
}
