export const compressedFormats = [
  { id: "jpeg", label: "JPEG (.jpg)", group: "Compressed", megabytesPerMegapixel: 0.25 },
  { id: "heic", label: "HEIC (.heic)", group: "Compressed", megabytesPerMegapixel: 0.16 },
  { id: "heif", label: "HEIF (.heif)", group: "Compressed", megabytesPerMegapixel: 0.16 },
] as const;

export const rawFormats = [
  { id: "cr2", label: "Canon CR2 (.CR2)", group: "Camera RAW", compressedRatio: 0.54, losslessRatio: 0.7 },
  { id: "cr3", label: "Canon CR3 (.CR3)", group: "Camera RAW", compressedRatio: 0.54, losslessRatio: 0.7 },
  { id: "nef", label: "Nikon NEF (.NEF)", group: "Camera RAW", compressedRatio: 0.55, losslessRatio: 0.7 },
  { id: "nrw", label: "Nikon NRW (.NRW)", group: "Camera RAW", compressedRatio: 0.55, losslessRatio: 0.7 },
  { id: "arw", label: "Sony ARW (.ARW)", group: "Camera RAW", compressedRatio: 0.5, losslessRatio: 0.7 },
  { id: "arq", label: "Sony ARQ (.ARQ, pixel-shift set)", group: "Camera RAW", compressedRatio: 0.5, losslessRatio: 0.7 },
  { id: "raf", label: "Fujifilm RAF (.RAF)", group: "Camera RAW", compressedRatio: 0.3, losslessRatio: 0.6 },
  { id: "orf", label: "OM System ORF (.ORF)", group: "Camera RAW", compressedRatio: 0.55, losslessRatio: 0.7 },
  { id: "rw2", label: "Panasonic RW2 (.RW2)", group: "Camera RAW", compressedRatio: 0.55, losslessRatio: 0.7 },
  { id: "pef", label: "Pentax PEF (.PEF)", group: "Camera RAW", compressedRatio: 0.55, losslessRatio: 0.7 },
  { id: "srw", label: "Samsung SRW (.SRW)", group: "Camera RAW", compressedRatio: 0.55, losslessRatio: 0.7 },
  { id: "dng", label: "Ricoh DNG (.DNG)", group: "Camera RAW", compressedRatio: 0.55, losslessRatio: 0.78 },
  { id: "3fr", label: "Hasselblad 3FR (.3FR)", group: "Camera RAW", compressedRatio: 0.55, losslessRatio: 0.7 },
  { id: "iiq", label: "Phase One IIQ (.IIQ)", group: "Camera RAW", compressedRatio: 0.55, losslessRatio: 0.7 },
] as const;

export const photoFormats = [...compressedFormats, ...rawFormats] as const;
export const RAW_JPEG_FORMAT_ID = "raw-jpeg";
export const RAW_UNCOMPRESSED_MB_PER_MEGAPIXEL = 1.75;

export const rawCompressionModes = [
  { id: "compressed", label: "Compressed RAW (lossy)" },
  { id: "lossless", label: "Lossless compressed RAW" },
  { id: "uncompressed", label: "Uncompressed RAW (lossless)" },
] as const;

export type RawCompressionMode = (typeof rawCompressionModes)[number]["id"];
export type CapacityUnit = "MB" | "GB";
export type PixelShiftFrames = 4 | 16;

export type EstimateInput = {
  megapixels: number;
  capacityValue: number;
  capacityUnit: CapacityUnit;
  formatId: string;
  rawFormatId?: string;
  rawCompressionMode?: RawCompressionMode;
  pixelShiftFrames?: PixelShiftFrames;
};

export type PhotoSizeOptions = {
  rawFormatId?: string;
  rawCompressionMode?: RawCompressionMode;
  pixelShiftFrames?: PixelShiftFrames;
};

export type CardEstimate = {
  megapixels: number;
  capacityMegabytes: number;
  photoSizeMegabytes: number;
  photoCount: number;
  usedMegabytes: number;
  remainingMegabytes: number;
};

export function megapixelsFromDimensions(width: number, height: number): number | null {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return null;
  }

  const megapixels = (width * height) / 1_000_000;
  return Number.isFinite(megapixels) && megapixels > 0 ? megapixels : null;
}

export function capacityToMegabytes(value: number, unit: CapacityUnit): number | null {
  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }

  if (unit === "MB") return value;
  if (unit === "GB") return value * 1_000;
  return null;
}

function estimateRawMegabytes(megapixels: number, rawFormatId: string, mode: RawCompressionMode): number | null {
  const format = rawFormats.find((item) => item.id === rawFormatId);
  if (!format) return null;

  let ratio: number;
  if (mode === "compressed") {
    ratio = format.compressedRatio;
  } else if (mode === "lossless") {
    ratio = format.losslessRatio;
  } else if (mode === "uncompressed") {
    ratio = 1;
  } else {
    return null;
  }

  const size = megapixels * RAW_UNCOMPRESSED_MB_PER_MEGAPIXEL * ratio;
  return Number.isFinite(size) && size > 0 ? size : null;
}

export function estimatePhotoSizeMegabytes(
  megapixels: number,
  formatId: string,
  options: PhotoSizeOptions = {},
): number | null {
  if (!Number.isFinite(megapixels) || megapixels <= 0) {
    return null;
  }

  const rawCompressionMode = options.rawCompressionMode ?? "lossless";

  if (formatId === RAW_JPEG_FORMAT_ID) {
    if (!options.rawFormatId || options.rawFormatId === "arq") return null;

    const jpegFormat = compressedFormats.find((item) => item.id === "jpeg");
    const rawSize = estimateRawMegabytes(megapixels, options.rawFormatId, rawCompressionMode);
    if (!jpegFormat || rawSize === null) return null;

    const jpegSize = megapixels * jpegFormat.megabytesPerMegapixel;
    const combinedSize = rawSize + jpegSize;
    return Number.isFinite(combinedSize) && combinedSize > 0 ? combinedSize : null;
  }

  if (rawFormats.some((item) => item.id === formatId)) {
    if (formatId === "arq") {
      const frameCount = options.pixelShiftFrames ?? 4;
      if (frameCount !== 4 && frameCount !== 16) return null;

      const rawFrameSize = estimateRawMegabytes(megapixels, formatId, "uncompressed");
      return rawFrameSize === null ? null : rawFrameSize * frameCount;
    }

    return estimateRawMegabytes(megapixels, formatId, rawCompressionMode);
  }

  const format = compressedFormats.find((item) => item.id === formatId);
  if (!format) return null;

  const size = megapixels * format.megabytesPerMegapixel;
  return Number.isFinite(size) && size > 0 ? size : null;
}

export function calculateEstimate(input: EstimateInput): CardEstimate | null {
  const capacityMegabytes = capacityToMegabytes(input.capacityValue, input.capacityUnit);
  const photoSizeMegabytes = estimatePhotoSizeMegabytes(input.megapixels, input.formatId, {
    rawFormatId: input.rawFormatId,
    rawCompressionMode: input.rawCompressionMode,
    pixelShiftFrames: input.pixelShiftFrames,
  });

  if (capacityMegabytes === null || photoSizeMegabytes === null) {
    return null;
  }

  const photoCount = Math.floor(capacityMegabytes / photoSizeMegabytes);
  const usedMegabytes = photoCount * photoSizeMegabytes;

  return {
    megapixels: input.megapixels,
    capacityMegabytes,
    photoSizeMegabytes,
    photoCount,
    usedMegabytes,
    remainingMegabytes: Math.max(0, capacityMegabytes - usedMegabytes),
  };
}

export function formatMegabytes(value: number): string {
  if (value < 1) {
    return `${Math.round(value * 1_000)} KB`;
  }

  return `${Number(value.toFixed(1)).toLocaleString()} MB`;
}

export function formatRemainingCapacity(valueInMegabytes: number): string {
  if (valueInMegabytes >= 1_000) {
    const gigabytes = valueInMegabytes / 1_000;
    return `${Number(gigabytes.toFixed(1)).toLocaleString()} GB`;
  }

  return formatMegabytes(valueInMegabytes);
}
