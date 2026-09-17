"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import EXIF from "exif-js";
import JSZip from "jszip";
import { EXPORT_FORMATS, getExportFilename, getRasterMimeType, type ExportFormat } from "@/lib/export";
import { applyOrientation, getActualDimensions } from "@/lib/orientation";
import { getLayout, getLayoutDimensions, LAYOUTS, type LayoutId } from "@/lib/layouts";

interface BorderSettings { outerWidth: number; innerWidth: number; outerColor: string; innerColor: string; showInner: boolean; }
interface ImageData { id: string; name: string; src: string; width: number; height: number; orientation: number; revokeUrl?: boolean; }

const IMAGE_FILE_PATTERN = /\.(avif|gif|heic|heif|jpe?g|png|webp)$/i;
const isImageFile = (file: File) => file.type.startsWith("image/") || IMAGE_FILE_PATTERN.test(file.name);
const isZipFile = (file: File) => file.type === "application/zip" || /\.zip$/i.test(file.name);
let imageIdSequence = 0;

function createImageId(): string {
  const randomUUID = globalThis.crypto?.randomUUID;
  if (typeof randomUUID === "function") return randomUUID.call(globalThis.crypto);

  imageIdSequence += 1;
  return `image-${Date.now()}-${imageIdSequence}`;
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("The image could not load."));
    image.src = src;
  });
}

function getExifOrientation(file: File | Blob): Promise<number> {
  return new Promise((resolve) => {
    EXIF.getData(file as unknown as string, () => resolve(EXIF.getTag(file, "Orientation") || 1));
  });
}

async function getOrientationFromUrl(url: string): Promise<number> {
  try {
    const response = await fetch(url);
    return getExifOrientation(await response.blob());
  } catch {
    return 1;
  }
}

function drawCoverImage(context: CanvasRenderingContext2D, image: HTMLImageElement, data: ImageData, x: number, y: number, width: number, height: number): void {
  const dimensions = getActualDimensions(data.width, data.height, data.orientation);
  const scale = Math.max(width / dimensions.width, height / dimensions.height);
  const scaledWidth = dimensions.width * scale;
  const scaledHeight = dimensions.height * scale;

  context.save();
  context.beginPath();
  context.rect(x, y, width, height);
  context.clip();
  context.translate(x + (width - scaledWidth) / 2, y + (height - scaledHeight) / 2);
  context.scale(scale, scale);
  applyOrientation(context, data.orientation, data.width, data.height);
  context.drawImage(image, 0, 0);
  context.restore();
}

export default function Home() {
  const [images, setImages] = useState<ImageData[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [layoutId, setLayoutId] = useState<LayoutId>("single");
  const [exportFormat, setExportFormat] = useState<ExportFormat>("png");
  const [borderSettings, setBorderSettings] = useState<BorderSettings>({ outerWidth: 50, innerWidth: 10, outerColor: "#ffffff", innerColor: "#000000", showInner: true });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [urlInput, setUrlInput] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const layout = getLayout(layoutId);
  const selectedImages = selectedIds.map((id) => images.find((image) => image.id === id)).filter((image): image is ImageData => image !== undefined);
  const hasCompleteSelection = selectedImages.length === layout.cells.length;

  useEffect(() => () => images.forEach((image) => { if (image.revokeUrl) URL.revokeObjectURL(image.src); }), [images]);

  const loadFile = useCallback(async (file: File): Promise<ImageData> => {
    const src = URL.createObjectURL(file);
    try {
      const [orientation, image] = await Promise.all([getExifOrientation(file), loadImageElement(src)]);
      return { id: createImageId(), name: file.name, src, width: image.naturalWidth, height: image.naturalHeight, orientation, revokeUrl: true };
    } catch (loadError) {
      URL.revokeObjectURL(src);
      throw loadError;
    }
  }, []);

  const readZipImages = useCallback(async (archive: File): Promise<File[]> => {
    const zip = await JSZip.loadAsync(archive);
    const entries = Object.values(zip.files).filter((entry) => !entry.dir && IMAGE_FILE_PATTERN.test(entry.name)).sort((first, second) => first.name.localeCompare(second.name));
    return Promise.all(entries.map(async (entry) => {
      const blob = await entry.async("blob");
      return new File([blob], entry.name.split("/").pop() || entry.name, { type: blob.type || "image/*" });
    }));
  }, []);

  const replaceImages = useCallback(async (files: File[]) => {
    setIsLoading(true);
    setError(null);
    try {
      const directImages = files.filter(isImageFile);
      const archiveImages = await Promise.all(files.filter(isZipFile).map(readZipImages));
      const imageFiles = [...directImages, ...archiveImages.flat()];
      if (imageFiles.length === 0) throw new Error("Select image files or a ZIP archive that contains images.");
      const loadedImages = await Promise.all(imageFiles.sort((first, second) => first.name.localeCompare(second.name)).map(loadFile));
      setImages(loadedImages);
      setSelectedIds(loadedImages.slice(0, layout.cells.length).map((image) => image.id));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "The images could not load.");
    } finally {
      setIsLoading(false);
    }
  }, [layout.cells.length, loadFile, readZipImages]);

  const loadUrl = async () => {
    const url = urlInput.trim();
    if (!url) return;
    setIsLoading(true);
    setError(null);
    try {
      const [image, orientation] = await Promise.all([loadImageElement(url), getOrientationFromUrl(url)]);
      const item = { id: createImageId(), name: "Image from URL", src: url, width: image.naturalWidth, height: image.naturalHeight, orientation };
      setImages([item]);
      setSelectedIds([item.id]);
    } catch {
      setError("The image URL could not load. Check the URL and its access settings.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    void replaceImages(Array.from(event.target.files || []));
    event.target.value = "";
  };
  const handleDrop = (event: React.DragEvent) => { event.preventDefault(); void replaceImages(Array.from(event.dataTransfer.files)); };
  const handlePaste = (event: React.ClipboardEvent) => {
    const files = Array.from(event.clipboardData.files).filter(isImageFile);
    if (files.length > 0) void replaceImages(files);
  };
  const selectLayout = (nextLayoutId: LayoutId) => {
    const nextLayout = getLayout(nextLayoutId);
    setLayoutId(nextLayoutId);
    setSelectedIds(images.slice(0, nextLayout.cells.length).map((image) => image.id));
  };
  const toggleImage = (id: string) => setSelectedIds((current) => {
    if (current.includes(id)) return current.filter((selectedId) => selectedId !== id);
    return current.length === layout.cells.length ? current : [...current, id];
  });

  const drawLayout = useCallback(async () => {
    if (!canvasRef.current || !hasCompleteSelection) return;
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");
    if (!context) return;
    try {
      const sourceImages = await Promise.all(selectedImages.map((image) => loadImageElement(image.src)));
      const firstImage = selectedImages[0];
      const cell = getActualDimensions(firstImage.width, firstImage.height, firstImage.orientation);
      const innerWidth = borderSettings.showInner ? borderSettings.innerWidth : 0;
      const dimensions = getLayoutDimensions(layout, cell.width, cell.height, borderSettings.outerWidth, innerWidth);
      canvas.width = dimensions.width;
      canvas.height = dimensions.height;
      context.fillStyle = borderSettings.outerColor;
      context.fillRect(0, 0, dimensions.width, dimensions.height);
      if (borderSettings.showInner) {
        context.fillStyle = borderSettings.innerColor;
        context.fillRect(borderSettings.outerWidth, borderSettings.outerWidth, dimensions.width - borderSettings.outerWidth * 2, dimensions.height - borderSettings.outerWidth * 2);
      }
      const frameWidth = borderSettings.outerWidth + innerWidth;
      layout.cells.forEach((position, index) => {
        const columnSpan = position.columnSpan || 1;
        const rowSpan = position.rowSpan || 1;
        const width = cell.width * columnSpan + innerWidth * (columnSpan - 1);
        const height = cell.height * rowSpan + innerWidth * (rowSpan - 1);
        const x = frameWidth + position.column * (cell.width + innerWidth);
        const y = frameWidth + position.row * (cell.height + innerWidth);
        drawCoverImage(context, sourceImages[index], selectedImages[index], x, y, width, height);
      });
    } catch (renderError) {
      console.error("The preview could not render the selected images.", renderError);
    }
  }, [borderSettings, hasCompleteSelection, layout, selectedImages]);

  useEffect(() => { void drawLayout(); }, [drawLayout]);
  const download = async () => {
    if (!canvasRef.current) return;
    try {
      if (exportFormat === "pdf") {
        const { jsPDF } = await import("jspdf");
        const canvas = canvasRef.current;
        const pdf = new jsPDF({
          orientation: canvas.width > canvas.height ? "landscape" : "portrait",
          unit: "px",
          format: [canvas.width, canvas.height],
          hotfixes: ["px_scaling"],
        });
        pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, canvas.width, canvas.height);
        pdf.save(getExportFilename(exportFormat));
        return;
      }

      const link = document.createElement("a");
      link.download = getExportFilename(exportFormat);
      link.href = canvasRef.current.toDataURL(getRasterMimeType(exportFormat), exportFormat === "png" ? undefined : 0.92);
      link.click();
    } catch {
      setError("The browser cannot export this image. The source URL may block image downloads.");
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white" onPaste={handlePaste}>
      <div className="container mx-auto max-w-6xl px-4 py-8">
        <header className="mb-8 text-center"><h1 className="bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-4xl font-bold text-transparent">Matter</h1><p className="mt-2 text-slate-400">Add borders, mats, and multi-image layouts.</p></header>
        <div className="grid gap-8 lg:grid-cols-2">
          <div className="space-y-6">
            <section className="rounded-2xl border border-slate-700/50 bg-slate-800/50 p-6 backdrop-blur-sm" onDrop={handleDrop} onDragOver={(event) => event.preventDefault()}>
              <h2 className="mb-4 text-lg font-semibold">Images</h2>
              <div className="rounded-xl border-2 border-dashed border-slate-600 p-6 text-center">
                <p className="text-slate-300">Add images, a folder, or a ZIP archive.</p><p className="mt-1 text-sm text-slate-500">Drag files here, paste images, or select a source.</p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  <button type="button" onClick={() => fileInputRef.current?.click()} className="rounded-lg bg-blue-600 px-4 py-2 text-sm hover:bg-blue-700">Images or ZIP</button>
                  <button type="button" onClick={() => folderInputRef.current?.click()} className="rounded-lg border border-slate-600 px-4 py-2 text-sm hover:bg-slate-700">Folder</button>
                </div>
                <input ref={fileInputRef} type="file" accept="image/*,.zip,application/zip" multiple onChange={handleFileUpload} className="hidden" />
                <input ref={(element) => { folderInputRef.current = element; element?.setAttribute("webkitdirectory", ""); }} type="file" accept="image/*" multiple onChange={handleFileUpload} className="hidden" />
              </div>
              <div className="mt-4 flex gap-2"><input type="url" value={urlInput} onChange={(event) => setUrlInput(event.target.value)} onKeyDown={(event) => event.key === "Enter" && void loadUrl()} placeholder="Or enter one image URL" className="min-w-0 flex-1 rounded-lg border border-slate-600 bg-slate-700/50 px-3 py-2 text-white placeholder-slate-400" /><button type="button" onClick={() => void loadUrl()} disabled={isLoading || !urlInput.trim()} className="rounded-lg bg-blue-600 px-4 py-2 disabled:cursor-not-allowed disabled:bg-slate-600">Load</button></div>
              {images.length > 0 && <ImageSelector images={images} selectedIds={selectedIds} count={layout.cells.length} onToggle={toggleImage} />}
              {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
            </section>
            <section className="rounded-2xl border border-slate-700/50 bg-slate-800/50 p-6 backdrop-blur-sm">
              <h2 className="mb-4 text-lg font-semibold">Layout</h2><label className="block text-sm text-slate-300" htmlFor="layout">Panel arrangement</label>
              <select id="layout" value={layoutId} onChange={(event) => selectLayout(event.target.value as LayoutId)} className="mt-2 w-full rounded-lg border border-slate-600 bg-slate-700/50 px-3 py-2 text-white">{LAYOUTS.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
              <p className="mt-2 text-sm text-slate-500">{layout.description} Matter crops each panel to fill its space.</p>
            </section>
            <BorderControls settings={borderSettings} onChange={setBorderSettings} />
            {hasCompleteSelection && <div className="flex gap-2"><label className="sr-only" htmlFor="export-format">Export format</label><select id="export-format" value={exportFormat} onChange={(event) => setExportFormat(event.target.value as ExportFormat)} className="rounded-xl border border-slate-600 bg-slate-700/50 px-3 py-3 text-white">{EXPORT_FORMATS.map((format) => <option key={format.id} value={format.id}>{format.label}</option>)}</select><button type="button" onClick={() => void download()} className="flex-1 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 py-3 font-semibold hover:from-blue-700 hover:to-purple-700">Download {EXPORT_FORMATS.find((format) => format.id === exportFormat)?.label}</button></div>}
          </div>
          <section className="rounded-2xl border border-slate-700/50 bg-slate-800/50 p-6 backdrop-blur-sm"><h2 className="mb-4 text-lg font-semibold">Preview</h2><div className="flex min-h-[400px] items-center justify-center overflow-hidden rounded-xl bg-slate-900/50">{isLoading ? <div className="text-slate-400">Loading images...</div> : hasCompleteSelection ? <canvas ref={canvasRef} className="max-h-[600px] max-w-full object-contain shadow-2xl" /> : <div className="px-6 text-center text-slate-500"><p>{images.length === 0 ? "No images loaded" : `Select ${layout.cells.length} image${layout.cells.length === 1 ? "" : "s"} to preview this layout.`}</p></div>}</div></section>
        </div>
      </div>
    </main>
  );
}

function ImageSelector({ images, selectedIds, count, onToggle }: { images: ImageData[]; selectedIds: string[]; count: number; onToggle: (id: string) => void; }) {
  return <div className="mt-5"><div className="mb-2 flex items-center justify-between gap-3 text-sm"><p className="text-slate-300">Select {count} image{count === 1 ? "" : "s"} in order.</p><span className="text-slate-500">{selectedIds.length}/{count}</span></div><div className="grid max-h-80 grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">{images.map((image) => { const position = selectedIds.indexOf(image.id); const selected = position >= 0; return <button key={image.id} type="button" onClick={() => onToggle(image.id)} disabled={!selected && selectedIds.length === count} className={`relative overflow-hidden rounded-lg border text-left disabled:cursor-not-allowed ${selected ? "border-blue-400 ring-2 ring-blue-500" : "border-slate-600"}`}><img src={image.src} alt="" className="h-20 w-full object-cover" /><span className="block truncate px-2 py-1 text-xs text-slate-300">{image.name}</span>{selected && <span className="absolute left-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-blue-600 text-xs font-bold">{position + 1}</span>}</button>; })}</div></div>;
}

function BorderControls({ settings, onChange }: { settings: BorderSettings; onChange: React.Dispatch<React.SetStateAction<BorderSettings>>; }) {
  return <section className="rounded-2xl border border-slate-700/50 bg-slate-800/50 p-6 backdrop-blur-sm"><h2 className="mb-4 text-lg font-semibold">Border settings</h2><RangeControl label="Outer border width" value={settings.outerWidth} max={200} onChange={(outerWidth) => onChange((current) => ({ ...current, outerWidth }))} /><ColorControl label="Outer border color" value={settings.outerColor} onChange={(outerColor) => onChange((current) => ({ ...current, outerColor }))} /><div className="mt-6 border-t border-slate-700 pt-5"><label className="flex items-center justify-between text-slate-300"><span>Inner border and panel gaps</span><input type="checkbox" checked={settings.showInner} onChange={() => onChange((current) => ({ ...current, showInner: !current.showInner }))} className="h-5 w-5 accent-blue-500" /></label>{settings.showInner && <div className="mt-4"><RangeControl label="Inner border and gap width" value={settings.innerWidth} max={100} onChange={(innerWidth) => onChange((current) => ({ ...current, innerWidth }))} /><ColorControl label="Inner border and gap color" value={settings.innerColor} onChange={(innerColor) => onChange((current) => ({ ...current, innerColor }))} /></div>}</div></section>;
}

function RangeControl({ label, value, max, onChange }: { label: string; value: number; max: number; onChange: (value: number) => void; }) {
  return <label className="mb-4 block text-slate-300"><span className="mb-2 flex justify-between text-sm"><span>{label}</span><span>{value}px</span></span><input type="range" min="0" max={max} value={value} onChange={(event) => onChange(Number(event.target.value))} className="w-full accent-blue-500" /></label>;
}

function ColorControl({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void; }) {
  return <label className="mb-4 block text-sm text-slate-300"><span className="mb-2 block">{label}</span><span className="flex gap-2"><input type="color" value={value} onChange={(event) => onChange(event.target.value)} className="h-10 w-12 rounded border border-slate-600 bg-transparent" /><input type="text" value={value} onChange={(event) => onChange(event.target.value)} className="min-w-0 flex-1 rounded-lg border border-slate-600 bg-slate-700/50 px-3 py-2 font-mono text-white" /></span></label>;
}
