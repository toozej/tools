'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { PhotoEntry } from './api/photos/route';

const MAX_IMAGE_RETRIES = 3;
const IMAGE_RETRY_DELAY = 1000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function ImageWithRetry({
  src,
  alt,
  className,
  loading,
}: {
  src: string;
  alt: string;
  className?: string;
  loading?: 'lazy' | 'eager';
}) {
  const [retryCount, setRetryCount] = useState(0);
  const [currentSrc, setCurrentSrc] = useState(src);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setCurrentSrc(src);
    setRetryCount(0);
    setFailed(false);
  }, [src]);

  const handleError = async () => {
    if (retryCount < MAX_IMAGE_RETRIES) {
      await sleep(IMAGE_RETRY_DELAY * (retryCount + 1));
      setRetryCount((prev) => prev + 1);
      setCurrentSrc(`${src}?retry=${retryCount + 1}`);
    } else {
      setFailed(true);
    }
  };

  if (failed) {
    return (
      <div
        className={`${className ?? ''} flex items-center justify-center bg-neutral-700 text-neutral-400 text-xs`}
      >
        Failed to load
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={currentSrc}
      alt={alt}
      className={className}
      loading={loading}
      onError={handleError}
    />
  );
}

export default function Home() {
  const [input, setInput] = useState('');
  const [images, setImages] = useState<PhotoEntry[]>([]);
  const [nextPage, setNextPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loadingPage, setLoadingPage] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'feed'>('feed');
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [hasSearched, setHasSearched] = useState(false);

  // Full-size URL resolution state
  const [fullsizeUrls, setFullsizeUrls] = useState<Map<string, string>>(new Map());
  const resolvingRef = useRef<Set<string>>(new Set());

  const sentinelRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadFnRef = useRef<(() => Promise<void>) | null>(null);

  // Resolve a photo's full-size URL
  const resolveFullsize = useCallback(async (photo: PhotoEntry) => {
    if (fullsizeUrls.has(photo.photoPage) || resolvingRef.current.has(photo.photoPage)) {
      return;
    }
    resolvingRef.current.add(photo.photoPage);

    try {
      const resp = await fetch(
        `/lomo-homes-viewer/api/photo-detail?photoPage=${encodeURIComponent(photo.photoPage)}`
      );
      if (!resp.ok) return;
      const data = await resp.json();
      if (data.fullsize) {
        setFullsizeUrls((prev) => {
          const next = new Map(prev);
          next.set(photo.photoPage, data.fullsize);
          return next;
        });
      }
    } catch {
      // Silently fail — fallback to thumbnail
    } finally {
      resolvingRef.current.delete(photo.photoPage);
    }
  }, [fullsizeUrls]);

  // Pre-load full-size URLs for feed view — resolve all loaded images
  // in batches of 5 so they're ready before the user scrolls to them.
  useEffect(() => {
    if (viewMode !== 'feed' || images.length === 0) return;

    const pending = images.filter(
      (img) => !fullsizeUrls.has(img.photoPage) && !resolvingRef.current.has(img.photoPage)
    );
    if (pending.length === 0) return;

    let cancelled = false;
    const BATCH_SIZE = 5;

    async function resolveBatch() {
      for (let i = 0; i < pending.length && !cancelled; i += BATCH_SIZE) {
        const batch = pending.slice(i, i + BATCH_SIZE);
        await Promise.all(batch.map((img) => resolveFullsize(img)));
      }
    }

    resolveBatch();
    return () => { cancelled = true; };
  }, [images, viewMode, fullsizeUrls, resolveFullsize]);

  const loadNextBatch = useCallback(async () => {
    if (loading || !hasMore || !input.trim()) return;

    setLoading(true);
    setLoadingPage(nextPage);

    try {
      const batchSize = viewMode === 'grid' ? 4 : 8;
      const response = await fetch(
        `/lomo-homes-viewer/api/photos?input=${encodeURIComponent(input.trim())}&page=${nextPage}&batchSize=${batchSize}`
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch photos (${response.status})`);
      }

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      const newImages: PhotoEntry[] = data.images ?? [];
      setImages((prev) => {
        const existing = new Set(prev.map((img) => img.thumbnail));
        const unique = newImages.filter((img) => !existing.has(img.thumbnail));
        return [...prev, ...unique];
      });
      setTotalCount((prev) => prev + newImages.length);
      setNextPage(data.endPage + 1);
      setHasMore(data.hasMore);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
      setHasMore(false);
    } finally {
      setLoading(false);
      setLoadingPage(null);
    }
  }, [loading, hasMore, nextPage, input, viewMode]);

  useEffect(() => {
    loadFnRef.current = loadNextBatch;
  }, [loadNextBatch]);

  // IntersectionObserver for infinite scroll loading
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && loadFnRef.current) {
          loadFnRef.current();
        }
      },
      { rootMargin: '600px' }
    );
    observerRef.current = observer;

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const observer = observerRef.current;
    const sentinel = sentinelRef.current;
    if (!observer || !sentinel || !hasSearched) return;

    observer.observe(sentinel);
    return () => observer.unobserve(sentinel);
  });

  const handleSearch = () => {
    if (!input.trim()) return;
    setHasSearched(true);
    setImages([]);
    setNextPage(1);
    setHasMore(true);
    setError(null);
    setTotalCount(0);
    setFullsizeUrls(new Map());
    resolvingRef.current.clear();
    Promise.resolve().then(() => {
      loadFnRef.current?.();
    });
  };

  const openLightbox = (index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
    // Resolve full-size for the lightbox image
    resolveFullsize(images[index]);
  };

  const getImageUrl = (img: PhotoEntry): string =>
    fullsizeUrls.get(img.photoPage) ?? img.thumbnail;

  return (
    <main className="min-h-screen bg-neutral-900 text-white">
      {/* Header */}
      <header className="bg-neutral-800 border-b border-neutral-700 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-4">
          <div className="flex items-center justify-between gap-2">
            <h1 className="text-lg sm:text-xl font-semibold truncate">Lomography Photo Viewer</h1>
            {images.length > 0 && (
              <div className="flex items-center gap-1 sm:gap-2 bg-neutral-700 rounded-lg p-1 flex-shrink-0">
                <button
                  onClick={() => setViewMode('feed')}
                  className={`px-2.5 sm:px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    viewMode === 'feed' ? 'bg-blue-600 text-white' : 'text-neutral-300 hover:text-white'
                  }`}
                >
                  Feed
                </button>
                <button
                  onClick={() => setViewMode('grid')}
                  className={`px-2.5 sm:px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    viewMode === 'grid' ? 'bg-blue-600 text-white' : 'text-neutral-300 hover:text-white'
                  }`}
                >
                  Grid
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Search Section */}
      <section className="bg-neutral-800 border-b border-neutral-700 py-6 sm:py-8">
        <div className="max-w-3xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="bg-neutral-700 rounded-lg p-4 sm:p-6 shadow-lg">
            <h2 className="text-base sm:text-lg font-medium mb-3 sm:mb-4 text-neutral-200">Enter Lomography URL or Username</h2>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="e.g. https://www.lomography.com/homes/aciano/photos or aciano"
                className="flex-1 px-4 py-2.5 sm:py-2 bg-neutral-600 border border-neutral-500 rounded-md text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-base"
              />
              <button
                onClick={handleSearch}
                disabled={loading}
                className="px-6 py-2.5 sm:py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:opacity-50 rounded-md font-medium transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
                    Loading{loadingPage ? ` pages ${loadingPage}+` : ''}...
                  </>
                ) : (
                  'Load Photos'
                )}
              </button>
            </div>
            {error && (
              <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-md text-red-300 text-sm">
                {error}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Photos Section */}
      <section className="py-6 sm:py-8">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          {images.length === 0 && !loading && (
            <div className="text-center py-16">
              <div className="text-6xl mb-4 opacity-20">📷</div>
              <h3 className="text-xl font-medium text-neutral-300 mb-2">No photos loaded</h3>
              <p className="text-neutral-400">Enter a Lomography URL or username to view photos</p>
            </div>
          )}

          {images.length > 0 && (
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-semibold">{totalCount} Photos</h2>
              <div className="text-sm text-neutral-400">
                {loading ? 'Loading more...' : hasMore ? 'Scroll for more' : `${totalCount} total`}
              </div>
            </div>
          )}

          {viewMode === 'grid' ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-4">
              {images.map((img, index) => (
                <div
                  key={img.thumbnail}
                  className="aspect-square rounded-lg overflow-hidden bg-neutral-700 cursor-pointer transition-transform hover:scale-105"
                  onClick={() => openLightbox(index)}
                >
                  <ImageWithRetry
                    src={img.thumbnail}
                    alt={`Photo ${index + 1}`}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="max-w-4xl mx-auto space-y-4">
              {images.map((img, index) => (
                <FeedImage
                  key={img.thumbnail}
                  img={img}
                  index={index}
                  fullsizeUrl={fullsizeUrls.get(img.photoPage)}
                  onClick={() => openLightbox(index)}
                />
              ))}
            </div>
          )}

          {/* IntersectionObserver sentinel — triggers loading the next batch */}
          <div ref={sentinelRef} className="h-4" aria-hidden="true" />

          {loading && images.length > 0 && (
            <div className="flex items-center justify-center gap-2 py-6 text-neutral-400">
              <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-neutral-400"></div>
              Loading{loadingPage ? ` pages ${loadingPage}+` : ''}...
            </div>
          )}

          {!hasMore && images.length > 0 && (
            <div className="text-center py-6 text-neutral-500 text-sm">End of photos</div>
          )}
        </div>
      </section>

      {/* Lightbox */}
      {lightboxOpen && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-2 sm:p-4">
          <button
            onClick={() => setLightboxOpen(false)}
            className="absolute top-3 right-3 sm:top-4 sm:right-4 bg-white/10 backdrop-blur-sm w-11 h-11 rounded-full flex items-center justify-center hover:bg-white/20 active:bg-white/30 transition-colors text-white text-xl leading-none z-10"
          >
            ×
          </button>
          <div className="relative w-full max-w-6xl max-h-full flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={getImageUrl(images[lightboxIndex])}
              alt={`Photo ${lightboxIndex + 1}`}
              className="max-w-full max-h-[85vh] object-contain"
            />
            <div className="absolute bottom-3 left-3 sm:bottom-4 sm:left-4 bg-black/50 backdrop-blur-sm px-3 py-1.5 rounded-md text-sm text-white">
              {lightboxIndex + 1} / {images.length}
              {fullsizeUrls.has(images[lightboxIndex]?.photoPage) && (
                <span className="ml-2 text-green-400">Full size</span>
              )}
            </div>
            <button
              onClick={() => {
                const next = (lightboxIndex - 1 + images.length) % images.length;
                setLightboxIndex(next);
                resolveFullsize(images[next]);
              }}
              className="absolute left-1 sm:left-4 top-1/2 -translate-y-1/2 bg-black/40 sm:bg-black/50 backdrop-blur-sm w-12 h-12 sm:w-10 sm:h-10 rounded-full flex items-center justify-center hover:bg-black/70 active:bg-black/80 transition-colors text-white text-lg"
            >
              ←
            </button>
            <button
              onClick={() => {
                const next = (lightboxIndex + 1) % images.length;
                setLightboxIndex(next);
                resolveFullsize(images[next]);
              }}
              className="absolute right-1 sm:right-4 top-1/2 -translate-y-1/2 bg-black/40 sm:bg-black/50 backdrop-blur-sm w-12 h-12 sm:w-10 sm:h-10 rounded-full flex items-center justify-center hover:bg-black/70 active:bg-black/80 transition-colors text-white text-lg"
            >
              →
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

/** Feed image card — shows thumbnail initially, swaps to full-size when resolved. */
function FeedImage({
  img,
  index,
  fullsizeUrl,
  onClick,
}: {
  img: PhotoEntry;
  index: number;
  fullsizeUrl?: string;
  onClick: () => void;
}) {
  const src = fullsizeUrl ?? img.thumbnail;

  return (
    <div
      className="bg-neutral-800 rounded-lg overflow-hidden cursor-pointer"
      onClick={onClick}
    >
      <div className="w-full flex items-center justify-center bg-black">
        <ImageWithRetry
          src={src}
          alt={`Photo ${index + 1}`}
          className="w-full h-auto max-h-[90vh] object-contain"
          loading="lazy"
        />
      </div>
      <div className="px-4 py-2 text-sm text-neutral-400 flex items-center justify-between">
        <span>{index + 1}</span>
        {fullsizeUrl && <span className="text-green-500">Full size</span>}
      </div>
    </div>
  );
}
