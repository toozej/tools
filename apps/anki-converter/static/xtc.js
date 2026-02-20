/**
 * xtc.js — XTC/XTCH format converter wrap for CREngine WASM
 */

function quantize(value, bits) {
    if (bits === 1) return value < 128 ? 0 : 255;
    if (value > 212) return 255;      // White
    if (value > 127) return 170;      // Light Gray
    if (value > 42) return 85;        // Dark Gray
    return 0;                         // Black
}

function applyDithering(data, width, height, bits, strength) {
    const gray = new Float32Array(width * height);
    for (let i = 0; i < width * height; i++) {
        const idx = i * 4;
        gray[i] = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
    }
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = y * width + x;
            const oldPixel = gray[idx];
            const newPixel = quantize(oldPixel, bits);
            gray[idx] = newPixel;
            const error = (oldPixel - newPixel) * strength;
            if (x + 1 < width) gray[idx + 1] += error * 7 / 16;
            if (y + 1 < height) {
                if (x > 0) gray[idx + width - 1] += error * 3 / 16;
                gray[idx + width] += error * 5 / 16;
                if (x + 1 < width) gray[idx + width + 1] += error * 1 / 16;
            }
        }
    }
    for (let i = 0; i < width * height; i++) {
        const v = Math.max(0, Math.min(255, Math.round(gray[i])));
        const idx = i * 4;
        data[idx] = v;
        data[idx + 1] = v;
        data[idx + 2] = v;
    }
    return data;
}

function encodeXTG(data, width, height) {
    // XTG: 1-bit monochrome, row-major, MSB = leftmost pixel

    // Header: 22 bytes
    const header = new Uint8Array(22);
    const view = new DataView(header.buffer);

    // Magic "XTG\0"
    header[0] = 0x58; // X
    header[1] = 0x54; // T
    header[2] = 0x47; // G
    header[3] = 0x00;

    // Dimensions (per XTG spec - no version field!)
    view.setUint16(4, width, true);    // offset 0x04
    view.setUint16(6, height, true);   // offset 0x06
    header[8] = 0;                      // colorMode = 0 (monochrome)
    header[9] = 0;                      // compression = 0 (uncompressed)

    // Bitmap: 8 pixels per byte, MSB = leftmost
    const rowBytes = Math.ceil(width / 8);
    const dataSize = rowBytes * height;
    view.setUint32(10, dataSize, true); // offset 0x0A (dataSize)
    // md5 at 0x0E left as zeros (optional)
    const bitmap = new Uint8Array(rowBytes * height);

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const srcIdx = (y * width + x) * 4;
            const gray = data[srcIdx]; // Already grayscale after dithering

            if (gray >= 128) {
                // White pixel - set bit (per XTG spec: 0=black, 1=white)
                const byteIdx = y * rowBytes + Math.floor(x / 8);
                const bitIdx = 7 - (x % 8); // MSB first
                bitmap[byteIdx] |= (1 << bitIdx);
            }
        }
    }

    // Combine header + bitmap
    const result = new Uint8Array(header.length + bitmap.length);
    result.set(header, 0);
    result.set(bitmap, header.length);

    return result;
}

function encodeXTH(data, width, height) {
    // XTH: 2-bit grayscale, vertical scan (columns right-to-left)

    // Header: 22 bytes
    const header = new Uint8Array(22);
    const view = new DataView(header.buffer);

    // Magic "XTH\0"
    header[0] = 0x58; // X
    header[1] = 0x54; // T
    header[2] = 0x48; // H
    header[3] = 0x00;

    // Dimensions (per XTH spec - no version field!)
    view.setUint16(4, width, true);    // offset 0x04
    view.setUint16(6, height, true);   // offset 0x06
    header[8] = 0;                      // colorMode = 0
    header[9] = 0;                      // compression = 0

    // Two bit planes, vertical scan, columns right-to-left
    const colBytes = Math.ceil(height / 8);
    const dataSize = colBytes * width * 2; // Two bit planes
    view.setUint32(10, dataSize, true); // offset 0x0A (dataSize)
    // md5 at 0x0E left as zeros (optional)
    const plane0 = new Uint8Array(colBytes * width); // bit 0
    const plane1 = new Uint8Array(colBytes * width); // bit 1

    for (let x = width - 1; x >= 0; x--) {
        const colIdx = width - 1 - x;

        for (let y = 0; y < height; y++) {
            const srcIdx = (y * width + x) * 4;
            const gray = data[srcIdx];

            // Quantize to 2-bit (XTH LUT)
            let level;
            if (gray > 212) level = 0b00;      // White
            else if (gray > 127) level = 0b10; // Light Gray
            else if (gray > 42) level = 0b01;  // Dark Gray
            else level = 0b11;                 // Black

            const byteIdx = colIdx * colBytes + Math.floor(y / 8);
            const bitIdx = 7 - (y % 8);

            if (level & 0b01) plane0[byteIdx] |= (1 << bitIdx);
            if (level & 0b10) plane1[byteIdx] |= (1 << bitIdx);
        }
    }

    // Combine header + plane0 + plane1
    const result = new Uint8Array(header.length + plane0.length + plane1.length);
    result.set(header, 0);
    result.set(plane0, header.length);
    result.set(plane1, header.length + plane0.length);

    return result;
}

function buildXTCContainer(pages, metadata, toc, width, height, isHQ) {
    const magic = isHQ ? 'XTCH' : 'XTC\0';

    const title = metadata.title || 'Unknown';
    const author = metadata.author || '';

    // Calculate offsets
    const headerSize = 56;
    const metadataSize = 256;
    const chapterEntrySize = 96;
    const chaptersSize = toc.length * chapterEntrySize;
    const indexEntrySize = 16;
    const indexSize = pages.length * indexEntrySize;

    const metadataOffset = headerSize;
    const chapterOffset = metadataOffset + metadataSize;
    const indexOffset = chapterOffset + chaptersSize;
    const pageDataOffset = indexOffset + indexSize;

    // Build page index
    const pageOffsets = [];
    let currentOffset = pageDataOffset;
    for (let i = 0; i < pages.length; i++) {
        pageOffsets.push({ offset: currentOffset, size: pages[i].length });
        currentOffset += pages[i].length;
    }

    const totalSize = currentOffset;
    const buffer = new ArrayBuffer(totalSize);
    const view = new DataView(buffer);
    const bytes = new Uint8Array(buffer);

    // Write header (56 bytes)
    for (let i = 0; i < 4; i++) {
        bytes[i] = magic.charCodeAt(i);
    }
    view.setUint16(4, 1, true); // Version
    view.setUint16(6, pages.length, true); // Page count
    // Individual flag bytes per XTC spec
    bytes[8] = 0;   // readDirection (0 = L→R)
    bytes[9] = 1;   // hasMetadata
    bytes[10] = 0;  // hasThumbnails
    bytes[11] = toc.length > 0 ? 1 : 0;  // hasChapters
    view.setUint32(12, 1, true); // Current page (1-indexed)

    // Use BigInt for 64-bit values
    view.setBigUint64(16, BigInt(metadataOffset), true);
    view.setBigUint64(24, BigInt(indexOffset), true);
    view.setBigUint64(32, BigInt(pageDataOffset), true);
    view.setBigUint64(40, BigInt(0), true); // Reserved
    view.setBigUint64(48, BigInt(chapterOffset), true);

    // Write metadata (256 bytes)
    const encoder = new TextEncoder();
    const titleBytes = encoder.encode(title.substring(0, 126));
    const authorBytes = encoder.encode(author.substring(0, 62));

    bytes.set(titleBytes, metadataOffset);
    bytes[metadataOffset + 127] = 0; // Null terminator
    bytes.set(authorBytes, metadataOffset + 128);
    bytes[metadataOffset + 191] = 0; // Null terminator
    view.setUint32(metadataOffset + 192, Math.floor(Date.now() / 1000), true); // Timestamp
    view.setUint16(metadataOffset + 196, toc.length, true); // Chapter count

    // Write chapters
    let chapterPos = chapterOffset;
    for (let i = 0; i < toc.length; i++) {
        const ch = toc[i];
        if (!ch) continue;
        const chTitle = ch.title || ch.name || `Chapter ${i + 1}`;
        const chPage = ch.page || ch.startPage || 0;
        const chNameBytes = encoder.encode(chTitle.substring(0, 78));
        bytes.set(chNameBytes, chapterPos);
        bytes[chapterPos + 79] = 0;
        view.setUint16(chapterPos + 80, chPage + 1, true); // Start page (1-indexed)
        view.setUint16(chapterPos + 82, chPage + 1, true); // End page (placeholder)
        chapterPos += chapterEntrySize;
    }

    // Write index
    let indexPos = indexOffset;
    for (let i = 0; i < pages.length; i++) {
        view.setBigUint64(indexPos, BigInt(pageOffsets[i].offset), true);
        view.setUint32(indexPos + 8, pageOffsets[i].size, true);
        view.setUint16(indexPos + 12, width, true);
        view.setUint16(indexPos + 14, height, true);
        indexPos += indexEntrySize;
    }

    // Write page data
    let dataPos = pageDataOffset;
    for (let i = 0; i < pages.length; i++) {
        bytes.set(pages[i], dataPos);
        dataPos += pages[i].length;
    }

    return bytes;
}


let crModule = null;
let literataData = null;

async function loadDefaultFont(cr, renderer) {
    if (!literataData) {
        try {
            const fontUrl = 'https://raw.githubusercontent.com/google/fonts/main/ofl/literata/Literata%5Bopsz%2Cwght%5D.ttf';
            const response = await fetch(fontUrl);
            if (!response.ok) throw new Error('Failed to fetch font');
            literataData = new Uint8Array(await response.arrayBuffer());
        } catch (err) {
            console.warn('Could not fetch default font:', err);
            return;
        }
    }
    const ptr = cr.allocateMemory(literataData.length);
    cr.HEAPU8.set(literataData, ptr);
    renderer.registerFontFromMemory(ptr, literataData.length, 'Literata-Regular.ttf');
    cr.freeMemory(ptr);
}

window.convertEpubToXtc = async function (epubBase64, format, width, height, title, isLandscape) {
    try {
        if (!crModule) {
            if (typeof CREngine !== 'function') {
                throw new Error("CREngine is not loaded on the page.");
            }
            crModule = await CREngine();
        }

        if (isLandscape) {
            const temp = width;
            width = height;
            height = temp;
        }

        const epubBinary = atob(epubBase64);
        const epubData = new Uint8Array(epubBinary.length);
        for (let i = 0; i < epubBinary.length; i++) epubData[i] = epubBinary.charCodeAt(i);

        const isHQ = (format === 'xtch');
        const bits = isHQ ? 2 : 1;

        // Initialize renderer
        const renderer = new crModule.EpubRenderer(width, height);

        await loadDefaultFont(crModule, renderer);

        const ptr = crModule.allocateMemory(epubData.length);
        crModule.HEAPU8.set(epubData, ptr);

        try {
            renderer.loadEpubFromMemory(ptr, epubData.length);
            renderer.configureStatusBar(false, false, false, false, false, false, false, false, false);

            // Let's set some default settings
            renderer.setMargins(16, 16, 16, 16);
            renderer.setFontSize(32);
            renderer.setInterlineSpace(120);
            renderer.setFontWeight(400);
            renderer.setTextAlign(3); // justify
            renderer.setHyphenation(0);
            renderer.setFontFace('Literata');

            let toc = renderer.getToc() || [];
            let totalPages = renderer.getPageCount();
            if (totalPages === 0) {
                throw new Error(`renderer.getPageCount() returned 0. EPUB loaded with length ${epubData.length}`);
            }
            let pages = [];

            for (let i = 0; i < totalPages; i++) {
                renderer.goToPage(i);
                renderer.renderCurrentPage();
                let frameBuffer = renderer.getFrameBuffer();
                if (!frameBuffer || frameBuffer.length === 0) {
                    throw new Error(`Frame buffer empty on page ${i}`);
                }
                let imageData = new Uint8ClampedArray(frameBuffer);

                applyDithering(imageData, width, height, bits, 1.0);

                let encoded = isHQ ? encodeXTH(imageData, width, height) : encodeXTG(imageData, width, height);
                pages.push(encoded);
            }

            let metadata = { title: title || 'Anki Deck', author: 'anki-converter' };
            let container = buildXTCContainer(pages, metadata, toc, width, height, isHQ);

            // Download
            const blob = new Blob([container], { type: 'application/octet-stream' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const ext = isHQ ? '.xtch' : '.xtc';
            a.download = (title || 'deck') + ext;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 10000);

            // Notify Go WASM app that generation is complete
            if (typeof window.onXtcComplete === 'function') {
                window.onXtcComplete(ext);
            }
            return '';
        } finally {
            crModule.freeMemory(ptr);
            renderer.delete();
        }
    } catch (err) {
        console.error("XTC conversion failed:", err);
        if (typeof window.onXtcError === 'function') {
            window.onXtcError(err.toString());
        }
        return err.toString();
    }
};
