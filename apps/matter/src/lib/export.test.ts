import { describe, expect, it } from "bun:test";
import { getExportFilename, getRasterMimeType } from "./export";

describe("export utilities", () => {
  it("returns the correct MIME type for raster exports", () => {
    expect(getRasterMimeType("png")).toBe("image/png");
    expect(getRasterMimeType("jpg")).toBe("image/jpeg");
    expect(getRasterMimeType("webp")).toBe("image/webp");
  });

  it("uses the selected export extension", () => {
    expect(getExportFilename("pdf")).toBe("matted-layout.pdf");
  });
});
