'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import type { PhotoEntry } from '../app/api/photos/route';

export const MAX_IMAGE_RETRIES = 3;
export const IMAGE_RETRY_DELAY = 1000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function ImageWithRetry({
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
      key={src}
      src={currentSrc}
      alt={alt}
      className={className}
      loading={loading}
      onError={handleError}
    />
  );
}

export function FeedImage({
  img,
  index,
  fullsizeUrl,
  onClick,
  onResolveFullsize,
}: {
  img: PhotoEntry;
  index: number;
  fullsizeUrl?: string;
  onClick: () => void;
  onResolveFullsize?: (img: PhotoEntry) => void;
}) {
  const src = fullsizeUrl ?? img.thumbnail;
  const elRef = useRef<HTMLDivElement>(null);
  const resolvedRef = useRef(false);

  useEffect(() => {
    if (!onResolveFullsize || fullsizeUrl || resolvedRef.current) return;
    const el = elRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !resolvedRef.current) {
          resolvedRef.current = true;
          observer.disconnect();
          onResolveFullsize(img);
        }
      },
      { rootMargin: '600px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [img, fullsizeUrl, onResolveFullsize]);

  return (
    <div
      ref={elRef}
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

export function Lightbox({
  images,
  lightboxIndex,
  fullsizeUrls,
  onClose,
  onPrev,
  onNext,
  getImageUrl,
}: {
  images: PhotoEntry[];
  lightboxIndex: number;
  fullsizeUrls: Map<string, string>;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  getImageUrl: (img: PhotoEntry) => string;
}) {
  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-2 sm:p-4">
      <button
        onClick={onClose}
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
          onClick={onPrev}
          className="absolute left-1 sm:left-4 top-1/2 -translate-y-1/2 bg-black/40 sm:bg-black/50 backdrop-blur-sm w-12 h-12 sm:w-10 sm:h-10 rounded-full flex items-center justify-center hover:bg-black/70 active:bg-black/80 transition-colors text-white text-lg"
        >
          ←
        </button>
        <button
          onClick={onNext}
          className="absolute right-1 sm:right-4 top-1/2 -translate-y-1/2 bg-black/40 sm:bg-black/50 backdrop-blur-sm w-12 h-12 sm:w-10 sm:h-10 rounded-full flex items-center justify-center hover:bg-black/70 active:bg-black/80 transition-colors text-white text-lg"
        >
          →
        </button>
      </div>
    </div>
  );
}

export function useFullsizeResolver() {
  const [fullsizeUrls, setFullsizeUrls] = useState<Map<string, string>>(new Map());
  const queueRef = useRef<PhotoEntry[]>([]);
  const activeRef = useRef(0);
  const retryCountsRef = useRef(new Map<string, number>());
  const rateLimitedUntilRef = useRef(0);

  const CONCURRENCY = 2;
  const MAX_RETRIES = 5;
  const BASE_DELAY = 1000;
  const REQUEST_GAP = 500;
  const RATE_LIMIT_COOLDOWN = 5000;

  function backoff(photoId: string): number {
    const count = retryCountsRef.current.get(photoId) ?? 0;
    return Math.min(BASE_DELAY * Math.pow(2, count), 30000) * (0.5 + Math.random());
  }

  const processNextRef = useRef<() => void>(() => {});

  const processNext = useCallback(() => {
    const now = Date.now();
    if (now < rateLimitedUntilRef.current) {
      setTimeout(
        () => processNextRef.current(),
        rateLimitedUntilRef.current - now + 100
      );
      return;
    }

    if (activeRef.current >= CONCURRENCY || queueRef.current.length === 0) return;

    activeRef.current++;
    const photo = queueRef.current.shift()!;

    async function fetchFullsize() {
      try {
        const resp = await fetch(
          `/lomo-homes-viewer/api/photo-detail?photoPage=${encodeURIComponent(photo.photoPage)}`
        );
        if (resp.ok) {
          const data = await resp.json();
          if (data.fullsize) {
            setFullsizeUrls((prev) => {
              const next = new Map(prev);
              next.set(photo.photoPage, data.fullsize);
              return next;
            });
          }
          retryCountsRef.current.delete(photo.photoPage);
        } else {
          const retries = (retryCountsRef.current.get(photo.photoPage) ?? 0) + 1;
          if (resp.status === 429) {
            rateLimitedUntilRef.current = Date.now() + RATE_LIMIT_COOLDOWN;
          }
          if (retries <= MAX_RETRIES) {
            retryCountsRef.current.set(photo.photoPage, retries);
            queueRef.current.unshift(photo);
          }
        }
      } catch {
        const retries = (retryCountsRef.current.get(photo.photoPage) ?? 0) + 1;
        if (retries <= MAX_RETRIES) {
          retryCountsRef.current.set(photo.photoPage, retries);
          queueRef.current.unshift(photo);
        }
      } finally {
        activeRef.current--;
        setTimeout(() => processNextRef.current(), REQUEST_GAP);
      }
    }

    fetchFullsize();
  }, []);

  useEffect(() => {
    processNextRef.current = processNext;
  }, [processNext]);

  const resolveFullsize = useCallback(
    (photo: PhotoEntry) => {
      if (fullsizeUrls.has(photo.photoPage)) return;
      if (
        queueRef.current.some((p) => p.photoPage === photo.photoPage) ||
        retryCountsRef.current.has(photo.photoPage)
      ) {
        return;
      }
      queueRef.current.push(photo);
      processNextRef.current();
    },
    [fullsizeUrls]
  );

  const clearFullsize = useCallback(() => {
    setFullsizeUrls(new Map());
    queueRef.current = [];
    activeRef.current = 0;
    retryCountsRef.current.clear();
    rateLimitedUntilRef.current = 0;
  }, []);

  return { fullsizeUrls, resolveFullsize, clearFullsize };
}

export function ViewModeToggle({
  viewMode,
  onSetViewMode,
}: {
  viewMode: 'grid' | 'feed';
  onSetViewMode: (mode: 'grid' | 'feed') => void;
}) {
  return (
    <div className="flex items-center gap-1 sm:gap-2 bg-neutral-700 rounded-lg p-1 flex-shrink-0">
      <button
        onClick={() => onSetViewMode('feed')}
        className={`px-2.5 sm:px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
          viewMode === 'feed' ? 'bg-blue-600 text-white' : 'text-neutral-300 hover:text-white'
        }`}
      >
        Feed
      </button>
      <button
        onClick={() => onSetViewMode('grid')}
        className={`px-2.5 sm:px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
          viewMode === 'grid' ? 'bg-blue-600 text-white' : 'text-neutral-300 hover:text-white'
        }`}
      >
        Grid
      </button>
    </div>
  );
}

export type SortOrder = 'latest' | 'oldest' | 'trending';

export function SortSelector({
  sortOrder,
  onSortChange,
}: {
  sortOrder: SortOrder;
  onSortChange: (order: SortOrder) => void;
}) {
  return (
    <div className="flex items-center gap-1 sm:gap-2 bg-neutral-700 rounded-lg p-1 flex-shrink-0">
      <button
        onClick={() => onSortChange('latest')}
        className={`px-2.5 sm:px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
          sortOrder === 'latest' ? 'bg-blue-600 text-white' : 'text-neutral-300 hover:text-white'
        }`}
      >
        Latest
      </button>
      <button
        onClick={() => onSortChange('oldest')}
        className={`px-2.5 sm:px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
          sortOrder === 'oldest' ? 'bg-blue-600 text-white' : 'text-neutral-300 hover:text-white'
        }`}
      >
        Oldest
      </button>
      <button
        onClick={() => onSortChange('trending')}
        className={`px-2.5 sm:px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
          sortOrder === 'trending' ? 'bg-blue-600 text-white' : 'text-neutral-300 hover:text-white'
        }`}
      >
        Shuffle
      </button>
    </div>
  );
}

export function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}
