import JSZip from 'jszip';
import type { AnkiCard, AnkiDeck, EinkDevice } from './types';

/**
 * Generate e-ink optimized CSS based on device settings
 */
function generateEinkStyles(device: EinkDevice): string {
  return `
    body {
      font-family: ${device.fontFamily};
      font-size: ${device.fontSize}px;
      line-height: ${device.lineHeight};
      margin: ${device.margins}px;
      padding: 0;
      color: #000000;
      background-color: #ffffff;
      max-width: ${device.screenWidth - device.margins * 2}px;
    }
    
    .flashcard {
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      min-height: ${device.screenHeight - device.margins * 4}px;
      text-align: center;
      page-break-after: always;
    }
    
    .flashcard-content {
      width: 100%;
      padding: ${device.margins}px;
    }
    
    .card-title {
      font-size: ${device.fontSize * 0.8}px;
      color: #666666;
      margin-bottom: ${device.margins * 2}px;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    
    .card-number {
      font-weight: bold;
    }
    
    .card-text {
      font-size: ${device.fontSize * 1.2}px;
      line-height: ${device.lineHeight * 1.1};
    }
    
    /* Handle images in flashcards */
    .card-text img {
      max-width: 100%;
      height: auto;
      display: block;
      margin: ${device.margins}px auto;
    }
    
    /* Style lists */
    .card-text ul, .card-text ol {
      text-align: left;
      margin: ${device.margins}px 0;
      padding-left: ${device.margins * 2}px;
    }
    
    .card-text li {
      margin-bottom: ${device.margins / 2}px;
    }
    
    /* Code blocks */
    .card-text code, .card-text pre {
      font-family: 'Courier New', monospace;
      font-size: ${device.fontSize * 0.9}px;
      background-color: #f5f5f5;
      padding: 2px 4px;
    }
    
    .card-text pre {
      padding: ${device.margins}px;
      overflow-x: auto;
      text-align: left;
    }
    
    /* Page break helpers */
    .page-break {
      page-break-after: always;
    }
    
    /* Hide on e-ink */
    .no-eink {
      display: none;
    }
  `;
}

/**
 * Create XHTML content for a chapter
 */
function createChapterContent(
  title: string,
  bodyContent: string,
  css: string
): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head>
  <meta charset="UTF-8"/>
  <title>${escapeXml(title)}</title>
  <link rel="stylesheet" type="text/css" href="styles.css"/>
</head>
<body>
${bodyContent}
</body>
</html>`;
}

/**
 * Escape XML special characters
 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Create a chapter for the front (question) of a flashcard
 */
function createQuestionContent(card: AnkiCard, index: number): string {
  return `
      <div class="flashcard">
        <div class="flashcard-content">
          <div class="card-title">
            <span class="card-number">Question ${index + 1}</span>
          </div>
          <div class="card-text">
            ${card.front || '(Empty question)'}
          </div>
        </div>
      </div>
    `;
}

/**
 * Create a chapter for the back (answer) of a flashcard
 */
function createAnswerContent(card: AnkiCard, index: number): string {
  return `
      <div class="flashcard">
        <div class="flashcard-content">
          <div class="card-title">
            <span class="card-number">Answer ${index + 1}</span>
          </div>
          <div class="card-text">
            ${card.back || '(Empty answer)'}
          </div>
        </div>
      </div>
    `;
}

/**
 * Generate a UUID-like identifier
 */
function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Get current date in ISO format
 */
function getCurrentDate(): string {
  return new Date().toISOString().split('.')[0] + 'Z';
}

/**
 * Create mimetype file content
 */
function createMimetype(): string {
  return 'application/epub+zip';
}

/**
 * Create container.xml for META-INF
 */
function createContainerXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;
}

/**
 * Create content.opf (package document)
 */
function createContentOpf(
  uuid: string,
  title: string,
  description: string,
  chapters: { id: string; title: string }[]
): string {
  const manifestItems = chapters
    .map((ch) => `<item id="${ch.id}" href="${ch.id}.xhtml" media-type="application/xhtml+xml"/>`)
    .join('\n    ');

  const spineItems = chapters.map((ch) => `<itemref idref="${ch.id}"/>`).join('\n    ');

  return `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="BookId">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="BookId">urn:uuid:${uuid}</dc:identifier>
    <dc:title>${escapeXml(title)}</dc:title>
    <dc:language>en</dc:language>
    <dc:creator>Anki to EPUB Converter</dc:creator>
    <dc:publisher>Anki2EPUB</dc:publisher>
    <dc:description>${escapeXml(description)}</dc:description>
    <meta property="dcterms:modified">${getCurrentDate()}</meta>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="styles" href="styles.css" media-type="text/css"/>
    ${manifestItems}
  </manifest>
  <spine>
    <itemref idref="nav"/>
    ${spineItems}
  </spine>
</package>`;
}

/**
 * Create navigation document (nav.xhtml)
 */
function createNavDocument(
  title: string,
  chapters: { id: string; title: string }[]
): string {
  const navPoints = chapters
    .map((ch) => `<li><a href="${ch.id}.xhtml">${escapeXml(ch.title)}</a></li>`)
    .join('\n        ');

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head>
  <meta charset="UTF-8"/>
  <title>Table of Contents</title>
  <link rel="stylesheet" type="text/css" href="styles.css"/>
</head>
<body>
  <nav epub:type="toc">
    <h1>Table of Contents</h1>
    <ol>
      <li><a href="nav.xhtml">${escapeXml(title)}</a></li>
        ${navPoints}
    </ol>
  </nav>
</body>
</html>`;
}

/**
 * Generate an EPUB file from an Anki deck
 * Each flashcard gets two pages: one for the question, one for the answer
 */
export async function generateEpub(
  deck: AnkiDeck,
  device: EinkDevice
): Promise<ArrayBuffer> {
  const zip = new JSZip();
  const uuid = generateId();
  const css = generateEinkStyles(device);
  const bookTitle = `${deck.name} - Flashcards`;
  const description = `Flashcard deck converted from Anki. Contains ${deck.cards.length} cards optimized for ${device.name}.`;

  // Create chapters array
  const chapters: { id: string; title: string; content: string }[] = [];

  // Add introduction page
  chapters.push({
    id: 'intro',
    title: 'About This Deck',
    content: `
      <div class="flashcard">
        <div class="flashcard-content">
          <h1>${escapeXml(deck.name)}</h1>
          <p>This EPUB contains ${deck.cards.length} flashcards for e-reader study.</p>
          <p>Each flashcard has two pages:</p>
          <ul>
            <li><strong>Question #</strong> - The front of the card</li>
            <li><strong>Answer #</strong> - The back of the card</li>
          </ul>
          <p>Optimized for ${device.name} (${device.screenWidth}x${device.screenHeight})</p>
          <p style="margin-top: 2em; color: #666;">Navigate to the next page to begin studying.</p>
        </div>
      </div>
    `,
  });

  // Add chapters for each flashcard (question then answer)
  deck.cards.forEach((card, index) => {
    const num = index + 1;
    chapters.push({
      id: `q${num}`,
      title: `Question ${num}`,
      content: createQuestionContent(card, index),
    });
    chapters.push({
      id: `a${num}`,
      title: `Answer ${num}`,
      content: createAnswerContent(card, index),
    });
  });

  // Create mimetype (must be first and uncompressed)
  zip.file('mimetype', createMimetype(), { compression: 'STORE' });

  // Create META-INF directory
  const metaInf = zip.folder('META-INF');
  if (metaInf) {
    metaInf.file('container.xml', createContainerXml());
  }

  // Create OEBPS directory (content)
  const oebps = zip.folder('OEBPS');
  if (oebps) {
    // Add styles
    oebps.file('styles.css', css);

    // Add navigation document
    oebps.file('nav.xhtml', createNavDocument(bookTitle, chapters));

    // Add content.opf
    oebps.file(
      'content.opf',
      createContentOpf(uuid, bookTitle, description, chapters)
    );

    // Add chapter files
    chapters.forEach((chapter) => {
      oebps.file(
        `${chapter.id}.xhtml`,
        createChapterContent(chapter.title, chapter.content, css)
      );
    });
  }

  // Generate the EPUB as ArrayBuffer
  return await zip.generateAsync({
    type: 'arraybuffer',
    mimeType: 'application/epub+zip',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 },
  });
}

/**
 * Download an ArrayBuffer as an EPUB file
 */
export function downloadEpub(data: ArrayBuffer, filename: string): void {
  const blob = new Blob([data], { type: 'application/epub+zip' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.epub') ? filename : `${filename}.epub`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Clean up the URL
  URL.revokeObjectURL(url);
}
