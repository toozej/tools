import { describe, expect, test } from "bun:test";
import {
  calculateEstimate,
  capacityToMegabytes,
  estimatePhotoSizeMegabytes,
  formatMegabytes,
  formatRemainingCapacity,
  megapixelsFromDimensions,
  photoFormats,
  rawCompressionModes,
  rawFormats,
  RAW_UNCOMPRESSED_MB_PER_MEGAPIXEL,
  RAW_JPEG_FORMAT_ID,
  type CapacityUnit,
  type RawCompressionMode,
} from "../estimator";

describe("photo format estimates", () => {
  test("includes compressed formats and common camera RAW types", () => {
    const ids = photoFormats.map((format) => format.id);

    expect(ids).toEqual([
      "jpeg", "heic", "heif", "cr2", "cr3", "nef", "nrw", "arw", "arq", "raf", "orf", "rw2", "pef", "srw", "dng", "3fr", "iiq",
    ]);
    expect(new Set(ids).size).toBe(ids.length);
    expect(rawFormats.map((format) => format.id)).toContain("arq");
    expect(rawFormats.find((format) => format.id === "dng")?.label).toContain("Ricoh");
    expect(rawFormats.every((format) => format.compressedRatio > 0 && format.losslessRatio > 0)).toBe(true);
    expect(rawCompressionModes.map((mode) => mode.id)).toEqual(["compressed", "lossless", "uncompressed"]);
    expect(RAW_UNCOMPRESSED_MB_PER_MEGAPIXEL).toBe(1.75);
  });

  test("estimates JPEG, HEIF, and RAW sizes from megapixels", () => {
    expect(estimatePhotoSizeMegabytes(24, "jpeg")).toBe(6);
    expect(estimatePhotoSizeMegabytes(24, "heif")).toBeCloseTo(3.84);
    expect(estimatePhotoSizeMegabytes(24, "arw", { rawCompressionMode: "lossless" })).toBeCloseTo(29.4);
    expect(estimatePhotoSizeMegabytes(24, "dng", { rawCompressionMode: "lossless" })).toBeCloseTo(32.76);
  });

  test("adds the selected RAW and JPG file sizes for a combined shot", () => {
    expect(estimatePhotoSizeMegabytes(24, RAW_JPEG_FORMAT_ID, { rawFormatId: "arw", rawCompressionMode: "lossless" })).toBeCloseTo(35.4);
    expect(estimatePhotoSizeMegabytes(24, RAW_JPEG_FORMAT_ID)).toBeNull();
    expect(estimatePhotoSizeMegabytes(24, RAW_JPEG_FORMAT_ID, { rawFormatId: "jpeg" })).toBeNull();
    expect(estimatePhotoSizeMegabytes(24, RAW_JPEG_FORMAT_ID, { rawFormatId: "arq" })).toBeNull();
  });

  test("applies manufacturer-based compressed and lossless ratios", () => {
    expect(estimatePhotoSizeMegabytes(24, "cr2", { rawCompressionMode: "compressed" })).toBeCloseTo(22.68);
    expect(estimatePhotoSizeMegabytes(24, "nef", { rawCompressionMode: "compressed" })).toBeCloseTo(23.1);
    expect(estimatePhotoSizeMegabytes(24, "raf", { rawCompressionMode: "compressed" })).toBeCloseTo(12.6);
    expect(estimatePhotoSizeMegabytes(24, "raf", { rawCompressionMode: "lossless" })).toBeCloseTo(25.2);
    expect(estimatePhotoSizeMegabytes(24, "arw", { rawCompressionMode: "compressed" })).toBe(21);
    expect(estimatePhotoSizeMegabytes(24, "arw", { rawCompressionMode: "uncompressed" })).toBe(42);
    expect(estimatePhotoSizeMegabytes(24, "arw", { rawCompressionMode: "invalid" as RawCompressionMode })).toBeNull();
    expect(estimatePhotoSizeMegabytes(24, "unknown" )).toBeNull();
  });

  test("estimates Sony ARQ pixel-shift storage from uncompressed source frames", () => {
    expect(estimatePhotoSizeMegabytes(24, "arq", { pixelShiftFrames: 4 })).toBe(168);
    expect(estimatePhotoSizeMegabytes(24, "arq", { pixelShiftFrames: 16, rawCompressionMode: "compressed" })).toBe(672);
    expect(estimatePhotoSizeMegabytes(24, "arq", { pixelShiftFrames: 8 as 4 | 16 })).toBeNull();
  });

  test("rejects invalid megapixels and unknown formats", () => {
    expect(estimatePhotoSizeMegabytes(0, "jpeg")).toBeNull();
    expect(estimatePhotoSizeMegabytes(Number.NaN, "jpeg")).toBeNull();
    expect(estimatePhotoSizeMegabytes(24, "unknown")).toBeNull();
    expect(estimatePhotoSizeMegabytes(Number.MAX_VALUE, "3fr")).toBeNull();
  });
});

describe("megapixelsFromDimensions", () => {
  test("converts pixel dimensions to megapixels", () => {
    expect(megapixelsFromDimensions(6000, 4000)).toBe(24);
    expect(megapixelsFromDimensions(1920, 1080)).toBeCloseTo(2.0736);
  });

  test("rejects invalid dimensions and overflow", () => {
    expect(megapixelsFromDimensions(0, 4000)).toBeNull();
    expect(megapixelsFromDimensions(-1, 4000)).toBeNull();
    expect(megapixelsFromDimensions(6000, Number.NaN)).toBeNull();
    expect(megapixelsFromDimensions(Number.MAX_VALUE, 2)).toBeNull();
  });
});

describe("capacityToMegabytes", () => {
  test("keeps MB values and converts decimal GB values", () => {
    expect(capacityToMegabytes(512, "MB")).toBe(512);
    expect(capacityToMegabytes(64, "GB")).toBe(64_000);
  });

  test("rejects invalid capacities and units", () => {
    expect(capacityToMegabytes(0, "MB")).toBeNull();
    expect(capacityToMegabytes(-4, "GB")).toBeNull();
    expect(capacityToMegabytes(Number.POSITIVE_INFINITY, "GB")).toBeNull();
    expect(capacityToMegabytes(10, "TB" as CapacityUnit)).toBeNull();
  });
});

describe("calculateEstimate", () => {
  test("estimates how many JPEG photos fit on a decimal 64 GB card", () => {
    expect(calculateEstimate({ megapixels: 24, capacityValue: 64, capacityUnit: "GB", formatId: "jpeg" })).toEqual({
      megapixels: 24,
      capacityMegabytes: 64_000,
      photoSizeMegabytes: 6,
      photoCount: 10_666,
      usedMegabytes: 63_996,
      remainingMegabytes: 4,
    });
  });

  test("estimates RAW photos and handles a card that cannot fit one photo", () => {
    const rawEstimate = calculateEstimate({
      megapixels: 24,
      capacityValue: 64,
      capacityUnit: "GB",
      formatId: "arw",
      rawCompressionMode: "lossless",
    });
    expect(rawEstimate?.photoCount).toBe(2_176);
    expect(rawEstimate?.remainingMegabytes).toBeCloseTo(25.6);

    const smallCardEstimate = calculateEstimate({ megapixels: 24, capacityValue: 1, capacityUnit: "MB", formatId: "jpeg" });
    expect(smallCardEstimate?.photoCount).toBe(0);
    expect(smallCardEstimate?.usedMegabytes).toBe(0);
    expect(smallCardEstimate?.remainingMegabytes).toBe(1);
  });

  test("counts each RAW and JPG pair as one photo", () => {
    const estimate = calculateEstimate({
      megapixels: 24,
      capacityValue: 64,
      capacityUnit: "GB",
      formatId: RAW_JPEG_FORMAT_ID,
      rawFormatId: "arw",
      rawCompressionMode: "lossless",
    });

    expect(estimate?.photoSizeMegabytes).toBeCloseTo(35.4);
    expect(estimate?.photoCount).toBe(1_807);
    expect(estimate?.usedMegabytes).toBeCloseTo(63_967.8);
    expect(estimate?.remainingMegabytes).toBeCloseTo(32.2);
  });

  test("counts Sony ARQ pixel-shift sets using uncompressed source frame storage", () => {
    const estimate = calculateEstimate({
      megapixels: 24,
      capacityValue: 64,
      capacityUnit: "GB",
      formatId: "arq",
      pixelShiftFrames: 16,
    });

    expect(estimate?.photoSizeMegabytes).toBe(672);
    expect(estimate?.photoCount).toBe(95);
  });

  test("returns null when the capacity, image resolution, or format is invalid", () => {
    expect(calculateEstimate({ megapixels: 24, capacityValue: 0, capacityUnit: "GB", formatId: "jpeg" })).toBeNull();
    expect(calculateEstimate({ megapixels: Number.NaN, capacityValue: 64, capacityUnit: "GB", formatId: "jpeg" })).toBeNull();
    expect(calculateEstimate({ megapixels: 24, capacityValue: 64, capacityUnit: "GB", formatId: "unknown" })).toBeNull();
  });
});

describe("size labels", () => {
  test("shows values below one MB in KB and larger values in MB", () => {
    expect(formatMegabytes(0.15)).toBe("150 KB");
    expect(formatMegabytes(6)).toBe("6 MB");
    expect(formatMegabytes(12.34)).toBe("12.3 MB");
  });

  test("shows remaining capacity in GB when at least 1,000 MB remains", () => {
    expect(formatRemainingCapacity(1_234)).toBe("1.2 GB");
    expect(formatRemainingCapacity(500)).toBe("500 MB");
  });
});
