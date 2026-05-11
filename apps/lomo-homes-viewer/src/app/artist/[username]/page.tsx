'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import type { AlbumEntry } from '@/app/api/albums/route';
import { ImageWithRetry } from '@/components/shared';

export default function ArtistPage() {
  const params = useParams();
  const router = useRouter();
  const username = decodeURIComponent(params.username as string);

  const [albums, setAlbums] = useState<AlbumEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAlbums = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/lomo-homes-viewer/api/albums?input=${encodeURIComponent(username)}`
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch albums (${response.status})`);
      }

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      setAlbums(data.albums ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setLoading(false);
    }
  }, [username]);

  const fetchAlbumsRef = useRef(fetchAlbums);
  useEffect(() => {
    fetchAlbumsRef.current = fetchAlbums;
  }, [fetchAlbums]);

  useEffect(() => {
    fetchAlbumsRef.current();
  }, []);

  const handleViewAllPhotos = () => {
    router.push(`/?input=${encodeURIComponent(username)}`);
  };

  return (
    <main className="min-h-screen bg-neutral-900 text-white">
      {/* Header */}
      <header className="bg-neutral-800 border-b border-neutral-700 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <Link
                href="/"
                className="text-neutral-400 hover:text-white transition-colors"
              >
                ← Back
              </Link>
              <h1 className="text-lg sm:text-xl font-semibold truncate">{username}</h1>
            </div>
            <button
              onClick={handleViewAllPhotos}
              className="px-3 sm:px-4 py-1.5 bg-blue-600 hover:bg-blue-700 rounded-md text-sm font-medium transition-colors"
            >
              View All Photos
            </button>
          </div>
        </div>
      </header>

      {/* Albums Section */}
      <section className="py-6 sm:py-8">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          {loading && (
            <div className="flex items-center justify-center gap-2 py-16 text-neutral-400">
              <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-neutral-400"></div>
              Loading albums...
            </div>
          )}

          {error && (
            <div className="max-w-3xl mx-auto p-4 bg-red-500/10 border border-red-500/20 rounded-md text-red-300 text-sm">
              {error}
            </div>
          )}

          {!loading && !error && albums.length === 0 && (
            <div className="text-center py-16">
              <div className="text-6xl mb-4 opacity-20">📂</div>
              <h3 className="text-xl font-medium text-neutral-300 mb-2">No albums found</h3>
              <p className="text-neutral-400 mb-4">
                This user may not have any public albums
              </p>
              <button
                onClick={handleViewAllPhotos}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-md text-sm font-medium transition-colors"
              >
                View All Photos Instead
              </button>
            </div>
          )}

          {!loading && albums.length > 0 && (
            <>
              <div className="mb-6">
                <h2 className="text-xl font-semibold">{albums.length} Albums</h2>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
                {albums.map((album) => (
                  <Link
                    key={album.albumId}
                    href={`/artist/${encodeURIComponent(username)}/album/${album.albumId}`}
                    className="group"
                  >
                    <div className="aspect-square rounded-lg overflow-hidden bg-neutral-700 transition-transform group-hover:scale-105">
                      <ImageWithRetry
                        src={album.coverImage}
                        alt={album.title}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    </div>
                    <div className="mt-2">
                      <h3 className="text-sm font-medium text-neutral-200 truncate group-hover:text-white transition-colors">
                        {album.title}
                      </h3>
                    </div>
                  </Link>
                ))}
              </div>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
