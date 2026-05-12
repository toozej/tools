'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import type { PhotoEntry } from '@/app/api/photos/route';
import {
  ImageWithRetry,
  FeedImage,
  Lightbox,
  ViewModeToggle,
  SortSelector,
  useFullsizeResolver,
  shuffleArray,
  type SortOrder,
} from '@/components/shared';

export default function AlbumPage() {
  const params = useParams();
  const username = decodeURIComponent(params.username as string);
  const albumId = params.albumId as string;

  const [images, setImages] = useState<PhotoEntry[]>([]);
  const [nextPage, setNextPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loadingPage, setLoadingPage] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'feed'>('feed');
  const [sortOrder, setSortOrder] = useState<SortOrder>('latest');
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  const { fullsizeUrls, resolveFullsize, clearFullsize } =
    useFullsizeResolver();

  const sentinelRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadFnRef = useRef<(() => Promise<void>) | null>(null);

  const displayImages = useMemo(() => {
    if (sortOrder === 'oldest') {
      return [...images].reverse();
    } else if (sortOrder === 'trending') {
      return shuffleArray(images);
    } else {
      return [...images];
    }
  }, [images, sortOrder]);

  const loadNextBatch = useCallback(async () => {
    if (loading || !hasMore) return;

    setLoading(true);
    setLoadingPage(nextPage);

    try {
      const batchSize = viewMode === 'grid' ? 4 : 8;
      const response = await fetch(
        `/lomo-homes-viewer/api/album-photos?input=${encodeURIComponent(username)}&albumId=${albumId}&page=${nextPage}&batchSize=${batchSize}`
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch album photos (${response.status})`);
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
  }, [loading, hasMore, nextPage, username, albumId, viewMode]);

  useEffect(() => {
    loadFnRef.current = loadNextBatch;
  }, [loadNextBatch]);

  // Initial load
  useEffect(() => {
    loadFnRef.current?.();
  }, []);

  // IntersectionObserver for infinite scroll
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
    if (!observer || !sentinel) return;

    observer.observe(sentinel);
    return () => observer.unobserve(sentinel);
  });

  const handleSortChange = (order: SortOrder) => {
    setSortOrder(order);
  };

  const openLightbox = (index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
    resolveFullsize(displayImages[index]);
  };

  const getImageUrl = (img: PhotoEntry): string =>
    fullsizeUrls.get(img.photoPage) ?? img.thumbnail;

  return (
    <main className="min-h-screen bg-neutral-900 text-white">
      {/* Header */}
      <header className="bg-neutral-800 border-b border-neutral-700 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3 min-w-0">
              <Link
                href={`/artist/${encodeURIComponent(username)}`}
                className="text-neutral-400 hover:text-white transition-colors flex-shrink-0"
              >
                ← Albums
              </Link>
              <h1 className="text-lg sm:text-xl font-semibold truncate">
                {username} — Album {albumId}
              </h1>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <SortSelector sortOrder={sortOrder} onSortChange={handleSortChange} />
              <ViewModeToggle viewMode={viewMode} onSetViewMode={setViewMode} />
            </div>
          </div>
        </div>
      </header>

      {/* Photos Section */}
      <section className="py-6 sm:py-8">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          {error && (
            <div className="max-w-3xl mx-auto mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-md text-red-300 text-sm">
              {error}
            </div>
          )}

          {displayImages.length === 0 && !loading && !error && (
            <div className="text-center py-16">
              <div className="text-6xl mb-4 opacity-20">📷</div>
              <h3 className="text-xl font-medium text-neutral-300 mb-2">
                No photos in this album
              </h3>
              <p className="text-neutral-400">This album may be empty or private</p>
            </div>
          )}

          {displayImages.length > 0 && (
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-semibold">{totalCount} Photos</h2>
              <div className="text-sm text-neutral-400">
                {loading ? 'Loading more...' : hasMore ? 'Scroll for more' : `${totalCount} total`}
              </div>
            </div>
          )}

          {viewMode === 'grid' ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-4">
              {displayImages.map((img, index) => (
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
              {displayImages.map((img, index) => (
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

          {loading && displayImages.length > 0 && (
            <div className="flex items-center justify-center gap-2 py-6 text-neutral-400">
              <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-neutral-400"></div>
              Loading{loadingPage ? ` pages ${loadingPage}+` : ''}...
            </div>
          )}

          {!hasMore && displayImages.length > 0 && (
            <div className="text-center py-6 text-neutral-500 text-sm">End of album</div>
          )}
        </div>
      </section>

      {/* Lightbox */}
      {lightboxOpen && (
        <Lightbox
          images={displayImages}
          lightboxIndex={lightboxIndex}
          fullsizeUrls={fullsizeUrls}
          onClose={() => setLightboxOpen(false)}
          onPrev={() => {
            const next =
              (lightboxIndex - 1 + displayImages.length) % displayImages.length;
            setLightboxIndex(next);
            resolveFullsize(displayImages[next]);
          }}
          onNext={() => {
            const next = (lightboxIndex + 1) % displayImages.length;
            setLightboxIndex(next);
            resolveFullsize(displayImages[next]);
          }}
          getImageUrl={getImageUrl}
        />
      )}
    </main>
  );
}
