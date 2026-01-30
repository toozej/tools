import { openDB } from 'idb';

export async function saveEpub(blob: Blob): Promise<void> {
  const db = await openDB('epub-db', 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('epubs')) {
        db.createObjectStore('epubs');
      }
    },
  });
  await db.put('epubs', blob, 'latest');
}

export async function getEpub(): Promise<Blob | undefined> {
  const db = await openDB('epub-db', 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('epubs')) {
        db.createObjectStore('epubs');
      }
    },
  });
  return db.get('epubs', 'latest');
}