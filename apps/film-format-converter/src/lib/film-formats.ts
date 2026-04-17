export interface FilmFormat {
  id: string;
  name: string;
  category: 'video' | 'photo-digital' | 'photo-film';
  width: number;
  height: number;
  notes?: string;
}

export const filmFormats: FilmFormat[] = [
  // Video formats
  { id: 'super8', name: 'Super 8', category: 'video', width: 5.79, height: 4.01 },
  { id: '8mm', name: 'Standard 8mm', category: 'video', width: 4.88, height: 3.68 },
  { id: '16mm', name: '16mm', category: 'video', width: 10.26, height: 7.49 },
  { id: 'super16', name: 'Super 16mm', category: 'video', width: 12.52, height: 7.41 },
  { id: '35mm-full', name: '35mm Full Aperture', category: 'video', width: 24.9, height: 18.7 },
  { id: '35mm-academy', name: '35mm Academy', category: 'video', width: 22.0, height: 16.0 },

  // Digital sensor formats
  { id: 'nikon1', name: 'Nikon 1 CX', category: 'photo-digital', width: 13.2, height: 8.8 },
  { id: 'micro-four-thirds', name: 'Micro Four Thirds', category: 'photo-digital', width: 17.3, height: 13.0 },
  { id: 'aps-c-canon', name: 'APS-C (Canon)', category: 'photo-digital', width: 22.3, height: 14.9 },
  { id: 'aps-c', name: 'APS-C / DX (Nikon/Sony)', category: 'photo-digital', width: 23.6, height: 15.6 },
  { id: 'aps-h', name: 'APS-H', category: 'photo-digital', width: 27.9, height: 18.6 },
  { id: 'fullframe', name: 'Full Frame / 35mm FX', category: 'photo-digital', width: 36.0, height: 24.0 },
  { id: 'gfx-50s', name: 'Fujifilm GFX 44x33', category: 'photo-digital', width: 43.8, height: 32.9 },
  { id: 'hasselblad-xcd', name: 'Hasselblad XCD', category: 'photo-digital', width: 43.8, height: 32.9 },
  { id: 'phase-one-iq4', name: 'Phase One IQ4 54x40', category: 'photo-digital', width: 53.7, height: 40.4 },

  // Film formats
  { id: 'half-frame', name: '35mm Half Frame', category: 'photo-film', width: 24.0, height: 18.0 },
  { id: '35mm', name: '35mm / Full Frame', category: 'photo-film', width: 36.0, height: 24.0 },
  { id: '120-645', name: '120 Medium Format 6x4.5', category: 'photo-film', width: 56.0, height: 41.5 },
  { id: '120-66', name: '120 Medium Format 6x6', category: 'photo-film', width: 56.0, height: 56.0 },
  { id: '120-67', name: '120 Medium Format 6x7', category: 'photo-film', width: 70.0, height: 56.0 },
  { id: '120-69', name: '120 Medium Format 6x9', category: 'photo-film', width: 84.0, height: 56.0 },
  { id: '120-612', name: '120 Medium Format 6x12', category: 'photo-film', width: 112.0, height: 56.0 },
  { id: '4x5', name: 'Large Format 4x5"', category: 'photo-film', width: 101.6, height: 127.0 },
  { id: '5x7', name: 'Large Format 5x7"', category: 'photo-film', width: 127.0, height: 177.8 },
  { id: '8x10', name: 'Large Format 8x10"', category: 'photo-film', width: 203.2, height: 254.0 },
];

const REFERENCE_DIAGONAL = Math.hypot(36, 24);

export function calculateCropFactor(format: FilmFormat): number {
  const diagonal = Math.hypot(format.width, format.height);
  return REFERENCE_DIAGONAL / diagonal;
}

export function convertFocalLength(
  focalLength: number,
  fromFormat: FilmFormat,
  toFormat: FilmFormat
): number {
  const ffFocal = focalLength * calculateCropFactor(fromFormat);
  return ffFocal / calculateCropFactor(toFormat);
}
