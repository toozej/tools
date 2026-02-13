import type { AnkiCard, AnkiDeck } from './types';

/**
 * Parse an Anki .apkg file by sending it to the server API
 * This avoids the need for sql.js in the browser which requires Node.js modules
 */
export async function parseAnkiDeck(file: File | ArrayBuffer): Promise<AnkiDeck> {
  let fileToUpload: File;
  
  if (file instanceof File) {
    fileToUpload = file;
  } else {
    // Convert ArrayBuffer to File
    fileToUpload = new File([file], 'deck.apkg', { type: 'application/octet-stream' });
  }

  const formData = new FormData();
  formData.append('file', fileToUpload);

  const response = await fetch('/api/parse-anki', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to parse Anki deck');
  }

  return await response.json();
}

/**
 * Fetch an Anki deck from a URL
 */
export async function fetchAnkiDeckFromUrl(url: string): Promise<ArrayBuffer> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.statusText}`);
    }
    return await response.arrayBuffer();
  } catch (error) {
    throw new Error(`Failed to fetch Anki deck from URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
