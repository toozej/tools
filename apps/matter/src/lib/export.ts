export type ExportFormat = "png" | "pdf" | "jpg" | "webp";

export const EXPORT_FORMATS: { id: ExportFormat; label: string }[] = [
  { id: "png", label: "PNG" },
  { id: "pdf", label: "PDF" },
  { id: "jpg", label: "JPG" },
  { id: "webp", label: "WEBP" },
];

export function getRasterMimeType(format: Exclude<ExportFormat, "pdf">): string {
  switch (format) {
    case "jpg":
      return "image/jpeg";
    case "webp":
      return "image/webp";
    default:
      return "image/png";
  }
}

export function getExportFilename(format: ExportFormat): string {
  return `matted-layout.${format}`;
}
