'use client';

import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { PhotoEntry } from './api/photos/route';
import {
  ImageWithRetry,
  FeedImage,
  Lightbox,
  ViewModeToggle,
  useFullsizeResolver,
} from '../components/shared';

const KNOWN_ARTISTS = [
  'aciano', 'rik041', 'sirio174', 'mylatehope',
  'adi_totp', 'lomodesbro', 'anelace', 'lomovanrenier',
  'dearjme', 'yoavcoren', 'neanderthalis',
  'vikk', 'bravopires', 'herbert-4',
];

function getTodayKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
}

function getFeaturedArtist(): string {
  const key = getTodayKey();
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = ((hash << 5) - hash + key.charCodeAt(i)) | 0;
  }
  return KNOWN_ARTISTS[Math.abs(hash) % KNOWN_ARTISTS.length];
}

function getRandomArtist(): string {
  return KNOWN_ARTISTS[Math.floor(Math.random() * KNOWN_ARTISTS.length)];
}

export default function Home() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-neutral-900" />}>
      <HomeInner />
    </Suspense>
  );
}

function HomeInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
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

  const { fullsizeUrls, resolveFullsize, clearFullsize } =
    useFullsizeResolver();

  const sentinelRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadFnRef = useRef<(() => Promise<void>) | null>(null);

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
    clearFullsize();
    Promise.resolve().then(() => {
      loadFnRef.current?.();
    });
  };

  // Auto-search when navigated with ?input= param
  const autoSearchDone = useRef(false);
  useEffect(() => {
    if (autoSearchDone.current) return;
    const urlInput = searchParams.get('input');
    if (urlInput && !hasSearched) {
      autoSearchDone.current = true;
      setInput(urlInput);
      // Use a microtask so the input state is set before handleSearch reads it
      Promise.resolve().then(() => {
        setHasSearched(true);
        setImages([]);
        setNextPage(1);
        setHasMore(true);
        setError(null);
        setTotalCount(0);
        clearFullsize();
        // loadFnRef reads input from the closure, so we need to trigger after state update
        setTimeout(() => loadFnRef.current?.(), 0);
      });
    }
  }, [searchParams, hasSearched, clearFullsize]);

  const handleArtistClick = (artist: string) => {
    setInput(artist);
    setHasSearched(true);
    setImages([]);
    setNextPage(1);
    setHasMore(true);
    setError(null);
    setTotalCount(0);
    clearFullsize();
    router.push(`/?input=${encodeURIComponent(artist)}`);
    Promise.resolve().then(() => {
      loadFnRef.current?.();
    });
  };

  const handleRandomArtist = () => {
    const artist = getRandomArtist();
    handleArtistClick(artist);
  };

  const handleFeaturedArtist = () => {
    const artist = getFeaturedArtist();
    handleArtistClick(artist);
  };

  const openLightbox = (index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
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
            <h1 className="text-lg sm:text-xl font-semibold truncate">
              Lomography Photo Viewer
            </h1>
            {images.length > 0 && (
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => router.push(`/artist/${encodeURIComponent(input.trim())}`)}
                  className="px-3 py-1.5 bg-neutral-600 hover:bg-neutral-500 rounded-md text-sm font-medium transition-colors"
                >
                  View Albums
                </button>
                <ViewModeToggle viewMode={viewMode} onSetViewMode={setViewMode} />
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Search Section */}
      <section className="bg-neutral-800 border-b border-neutral-700 py-6 sm:py-8">
        <div className="max-w-3xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="bg-neutral-700 rounded-lg p-4 sm:p-6 shadow-lg">
            <h2 className="text-base sm:text-lg font-medium mb-3 sm:mb-4 text-neutral-200">
              Discover Lomographers
            </h2>

            {/* Quick action buttons */}
            <div className="flex flex-wrap gap-2 sm:gap-3 mb-4">
              <button
                onClick={handleRandomArtist}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-md text-sm font-medium transition-colors flex items-center gap-2"
              >
                🎲 Random Artist
              </button>
              <button
                onClick={handleFeaturedArtist}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 rounded-md text-sm font-medium transition-colors flex items-center gap-2"
              >
                ⭐ Featured Today
              </button>
            </div>

            <div className="border-t border-neutral-600 pt-4">
              <h3 className="text-sm font-medium mb-2 text-neutral-300">
                Or search by username
              </h3>
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
              <h3 className="text-xl font-medium text-neutral-300 mb-2">
                No photos loaded
              </h3>
              <p className="text-neutral-400">
                Enter a Lomography URL or username to view photos
              </p>
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
                  onResolveFullsize={resolveFullsize}
                />
              ))}
            </div>
          )}

          {/* IntersectionObserver sentinel */}
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
        <Lightbox
          images={images}
          lightboxIndex={lightboxIndex}
          fullsizeUrls={fullsizeUrls}
          onClose={() => setLightboxOpen(false)}
          onPrev={() => {
            const next = (lightboxIndex - 1 + images.length) % images.length;
            setLightboxIndex(next);
            resolveFullsize(images[next]);
          }}
          onNext={() => {
            const next = (lightboxIndex + 1) % images.length;
            setLightboxIndex(next);
            resolveFullsize(images[next]);
          }}
          getImageUrl={getImageUrl}
        />
      )}
    </main>
  );
}
