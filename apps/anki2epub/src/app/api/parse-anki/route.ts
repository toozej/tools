import { NextRequest, NextResponse } from 'next/server';
import JSZip from 'jszip';
import initSqlJs from 'sql.js';

// Type for SQL.js database
type SqlJsDatabase = {
  exec: (sql: string) => QueryResult[];
  close: () => void;
};

type QueryResult = {
  values: (string | number | null)[][];
};

// Initialize SQL.js on the server
async function getSqlJs(): Promise<new (data: Uint8Array) => SqlJsDatabase> {
  const SQL = await initSqlJs({
    locateFile: (file: string) => `node_modules/sql.js/dist/${file}`,
  });
  return SQL.Database as new (data: Uint8Array) => SqlJsDatabase;
}

interface AnkiCard {
  id: number;
  front: string;
  back: string;
}

interface AnkiDeck {
  name: string;
  cards: AnkiCard[];
}

/**
 * Clean HTML content from Anki cards
 */
function cleanHtml(content: string): string {
  if (!content) return '';
  
  // Remove script tags
  let cleaned = content.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  
  // Remove style tags
  cleaned = cleaned.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
  
  // Remove inline event handlers
  cleaned = cleaned.replace(/\s*on\w+="[^"]*"/gi, '');
  cleaned = cleaned.replace(/\s*on\w+='[^']*'/gi, '');
  
  // Trim whitespace
  cleaned = cleaned.trim();
  
  return cleaned;
}

/**
 * Parse an Anki .apkg file and extract flashcards
 */
async function parseAnkiDeck(buffer: ArrayBuffer): Promise<AnkiDeck> {
  // Extract the ZIP file
  const zip = new JSZip();
  const zipContents = await zip.loadAsync(buffer);

  // Find the collection.anki2 file (SQLite database)
  const collectionFile = zipContents.file('collection.anki2');
  if (!collectionFile) {
    throw new Error('Invalid Anki deck: collection.anki2 not found');
  }

  // Get the SQLite database as ArrayBuffer
  const dbBuffer = await collectionFile.async('arraybuffer');

  // Initialize SQL.js and load the database
  const Database = await getSqlJs();
  const db = new Database(new Uint8Array(dbBuffer));

  // Get deck name
  const decksResult = db.exec('SELECT decks FROM col');
  let deckName = 'Anki Deck';
  
  if (decksResult.length > 0 && decksResult[0] && decksResult[0].values.length > 0) {
    try {
      const decksJson = JSON.parse(decksResult[0].values[0][0] as string);
      const deckIds = Object.keys(decksJson);
      if (deckIds.length > 0) {
        deckName = decksJson[deckIds[0]].name || 'Anki Deck';
      }
    } catch {
      // Use default name if parsing fails
    }
  }

  // Extract cards from the notes table
  const notesResult = db.exec(`
    SELECT id, flds, mid
    FROM notes
    ORDER BY id
  `);

  const cards: AnkiCard[] = [];

  if (notesResult.length > 0) {
    for (const row of notesResult[0].values) {
      const id = row[0] as number;
      const fields = row[1] as string;
      
      // Fields are separated by \x1f character
      const fieldParts = fields.split('\x1f');
      
      if (fieldParts.length >= 2) {
        cards.push({
          id,
          front: cleanHtml(fieldParts[0]),
          back: cleanHtml(fieldParts[1]),
        });
      } else if (fieldParts.length === 1) {
        cards.push({
          id,
          front: cleanHtml(fieldParts[0]),
          back: '',
        });
      }
    }
  }

  db.close();

  if (cards.length === 0) {
    throw new Error('No flashcards found in the Anki deck');
  }

  return {
    name: deckName,
    cards,
  };
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    
    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    const buffer = await file.arrayBuffer();
    const deck = await parseAnkiDeck(buffer);

    return NextResponse.json(deck);
  } catch (error) {
    console.error('Error parsing Anki deck:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to parse Anki deck' },
      { status: 500 }
    );
  }
}
