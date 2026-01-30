import JSZip from 'jszip';
import { Readability } from '@mozilla/readability';

export async function convertUrlToEpub(
  url: string,
  includeMedia: boolean,
  eInk: boolean,
  onProgress: (progress: number) => void
): Promise<Blob> {
  onProgress(10);

  // Fetch HTML
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
  const html = await response.text();
  onProgress(30);

  // Parse and extract content
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const reader = new Readability(doc);
  const article = reader.parse();
  if (!article || !article.content) throw new Error('Failed to extract content');

  onProgress(50);

  let content = article.content;
  const zip = new JSZip();

  // Handle media
  if (includeMedia) {
    const images: { src: string; newSrc: string; blob: Blob }[] = [];
    const imgElements = doc.querySelectorAll('img');
    let imgIndex = 0;
    for (const img of imgElements) {
      const src = img.getAttribute('src');
      if (src && src.startsWith('http')) {
        try {
          const imgResponse = await fetch(src);
          if (!imgResponse.ok) {
            console.warn(`Failed to fetch image ${src}: ${imgResponse.status} ${imgResponse.statusText}`);
            continue; // Skip this image
          }
          let blob = await imgResponse.blob();
          if (eInk) {
            // Resize for e-ink
            blob = await resizeImage(blob, 600); // Max width 600px
          }
          const newSrc = `images/img${imgIndex}.jpg`;
          images.push({ src, newSrc, blob });
          content = content.replace(new RegExp(src.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), newSrc);
          imgIndex++;
        } catch {
          console.warn('Failed to fetch image:', src);
        }
      }
    }
    // Add images to zip
    for (const img of images) {
      zip.file(`OEBPS/${img.newSrc}`, img.blob);
    }
  }

  onProgress(80);

  // Create EPUB structure
  zip.file('mimetype', 'application/epub+zip');
  zip.file('META-INF/container.xml', `<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`);

  const opf = generateOpf(article.title || 'Untitled', includeMedia);
  zip.file('OEBPS/content.opf', opf);

  const ncx = generateNcx(article.title || 'Untitled');
  zip.file('OEBPS/toc.ncx', ncx);

  const css = eInk ? `
body { font-size: 14px; line-height: 1.4; }
img { max-width: 100%; height: auto; }
` : `
body { font-size: 16px; line-height: 1.5; }
img { max-width: 100%; height: auto; }
`;
  zip.file('OEBPS/styles.css', css);

  content = content.replace('<div', `<div xmlns="http://www.w3.org/1999/xhtml"`);
  content = `<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>${article.title}</title>
  <link rel="stylesheet" type="text/css" href="styles.css"/>
</head>
<body>
  <h1>${article.title}</h1>
  ${content}
</body>
</html>`;

  zip.file('OEBPS/content.html', content);

  onProgress(100);

  return zip.generateAsync({ type: 'blob' });
}

function generateOpf(title: string, hasImages: boolean): string {
  return `<?xml version="1.0"?>
<package version="2.0" xmlns="http://www.idpf.org/2007/opf" unique-identifier="BookId">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:opf="http://www.idpf.org/2007/opf">
    <dc:title>${title}</dc:title>
    <dc:creator>URL Converter</dc:creator>
    <dc:language>en</dc:language>
    <dc:identifier id="BookId">url-converter-${Date.now()}</dc:identifier>
  </metadata>
  <manifest>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
    <item id="content" href="content.html" media-type="application/xhtml+xml"/>
    <item id="styles" href="styles.css" media-type="text/css"/>
    ${hasImages ? '<item id="img0" href="images/img0.jpg" media-type="image/jpeg"/>' : ''}
  </manifest>
  <spine toc="ncx">
    <itemref idref="content"/>
  </spine>
</package>`;
}

function generateNcx(title: string): string {
  return `<?xml version="1.0"?>
<ncx version="2005-1" xmlns="http://www.daisy.org/z3986/2005/ncx/">
  <head>
    <meta name="dtb:uid" content="url-converter-${Date.now()}"/>
    <meta name="dtb:depth" content="1"/>
    <meta name="dtb:totalPageCount" content="0"/>
    <meta name="dtb:maxPageNumber" content="0"/>
  </head>
  <docTitle>
    <text>${title}</text>
  </docTitle>
  <navMap>
    <navPoint id="navPoint-1" playOrder="1">
      <navLabel>
        <text>${title}</text>
      </navLabel>
      <content src="content.html"/>
    </navPoint>
  </navMap>
</ncx>`;
}

async function resizeImage(blob: Blob, maxWidth: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      const ratio = maxWidth / img.width;
      canvas.width = maxWidth;
      canvas.height = img.height * ratio;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Failed to resize image'));
      }, 'image/jpeg', 0.8);
    };
    img.src = URL.createObjectURL(blob);
  });
}