"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import EXIF from "exif-js";

interface BorderSettings {
  outerWidth: number;
  innerWidth: number;
  outerColor: string;
  innerColor: string;
  showInner: boolean;
}

interface ImageData {
  src: string;
  width: number;
  height: number;
  orientation: number;
}

export default function Home() {
  const [image, setImage] = useState<ImageData | null>(null);
  const [borderSettings, setBorderSettings] = useState<BorderSettings>({
    outerWidth: 50,
    innerWidth: 10,
    outerColor: "#ffffff",
    innerColor: "#000000",
    showInner: true,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [urlInput, setUrlInput] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getExifOrientation = (file: File | Blob): Promise<number> => {
    return new Promise((resolve) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      EXIF.getData(file as any, function (this: any) {
        const orientation = EXIF.getTag(this, "Orientation");
        resolve(orientation || 1);
      });
    });
  };

  const getOrientationFromUrl = async (url: string): Promise<number> => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      return getExifOrientation(blob);
    } catch {
      return 1;
    }
  };

  const loadImage = useCallback(
    async (src: string, orientation: number = 1): Promise<void> => {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          setImage({
            src,
            width: img.naturalWidth,
            height: img.naturalHeight,
            orientation,
          });
          resolve();
        };
        img.onerror = () => reject(new Error("Failed to load image"));
        img.src = src;
      });
    },
    []
  );

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setError(null);

    try {
      const orientation = await getExifOrientation(file);
      const src = URL.createObjectURL(file);
      await loadImage(src, orientation);
    } catch (err) {
      setError("Failed to load image. Please try another file.");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUrlSubmit = async () => {
    if (!urlInput.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      // Try to fetch the image to get EXIF data
      let orientation = 1;
      try {
        orientation = await getOrientationFromUrl(urlInput);
      } catch {
        // If we can't get EXIF, continue with default orientation
      }

      await loadImage(urlInput, orientation);
    } catch (err) {
      setError(
        "Failed to load image from URL. Make sure the URL is correct and the image is accessible."
      );
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;

    for (const item of items) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) {
          setIsLoading(true);
          setError(null);
          try {
            const orientation = await getExifOrientation(file);
            const src = URL.createObjectURL(file);
            await loadImage(src, orientation);
          } catch (err) {
            setError("Failed to load pasted image.");
            console.error(err);
          } finally {
            setIsLoading(false);
          }
          return;
        }
      }

      // Check for URL in text
      if (item.type === "text/plain") {
        item.getAsString(async (text) => {
          const url = text.trim();
          if (url.startsWith("http")) {
            setUrlInput(url);
            setIsLoading(true);
            setError(null);
            try {
              const orientation = await getOrientationFromUrl(url);
              await loadImage(url, orientation);
            } catch (err) {
              setError("Failed to load image from pasted URL.");
              console.error(err);
            } finally {
              setIsLoading(false);
            }
          }
        });
      }
    }
  };

  const applyOrientation = (
    ctx: CanvasRenderingContext2D,
    orientation: number,
    width: number,
    height: number
  ) => {
    switch (orientation) {
      case 2:
        ctx.transform(-1, 0, 0, 1, width, 0);
        break;
      case 3:
        ctx.transform(-1, 0, 0, -1, width, height);
        break;
      case 4:
        ctx.transform(1, 0, 0, -1, 0, height);
        break;
      case 5:
        ctx.transform(0, 1, 1, 0, 0, 0);
        break;
      case 6:
        ctx.transform(0, 1, -1, 0, height, 0);
        break;
      case 7:
        ctx.transform(0, -1, -1, 0, height, width);
        break;
      case 8:
        ctx.transform(0, -1, 1, 0, 0, width);
        break;
    }
  };

  const drawImage = useCallback(() => {
    if (!image || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      // Determine actual dimensions based on orientation
      const isRotated = [5, 6, 7, 8].includes(image.orientation);
      const actualWidth = isRotated ? image.height : image.width;
      const actualHeight = isRotated ? image.width : image.height;

      // Calculate total dimensions including borders
      const innerWidth = borderSettings.showInner ? borderSettings.innerWidth : 0;
      const totalWidth =
        actualWidth + borderSettings.outerWidth * 2 + innerWidth * 2;
      const totalHeight =
        actualHeight + borderSettings.outerWidth * 2 + innerWidth * 2;

      canvas.width = totalWidth;
      canvas.height = totalHeight;

      // Draw outer border
      ctx.fillStyle = borderSettings.outerColor;
      ctx.fillRect(0, 0, totalWidth, totalHeight);

      // Draw inner border if enabled
      if (borderSettings.showInner) {
        ctx.fillStyle = borderSettings.innerColor;
        ctx.fillRect(
          borderSettings.outerWidth,
          borderSettings.outerWidth,
          actualWidth + innerWidth * 2,
          actualHeight + innerWidth * 2
        );
      }

      // Draw image with orientation
      ctx.save();
      const drawX = borderSettings.outerWidth + innerWidth;
      const drawY = borderSettings.outerWidth + innerWidth;

      if (isRotated) {
        ctx.translate(drawX, drawY);
        applyOrientation(ctx, image.orientation, image.width, image.height);
        ctx.drawImage(img, 0, 0);
      } else {
        ctx.translate(drawX, drawY);
        applyOrientation(ctx, image.orientation, image.width, image.height);
        ctx.drawImage(img, 0, 0);
      }
      ctx.restore();
    };
    img.src = image.src;
  }, [image, borderSettings]);

  useEffect(() => {
    drawImage();
  }, [drawImage]);

  const handleDownload = () => {
    if (!canvasRef.current) return;

    const link = document.createElement("a");
    link.download = "matted-image.png";
    link.href = canvasRef.current.toDataURL("image/png");
    link.click();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file || !file.type.startsWith("image/")) return;

    setIsLoading(true);
    setError(null);
    try {
      const orientation = await getExifOrientation(file);
      const src = URL.createObjectURL(file);
      await loadImage(src, orientation);
    } catch (err) {
      setError("Failed to load dropped image.");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  return (
    <main
      className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white"
      onPaste={handlePaste}
    >
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
            Matter
          </h1>
          <p className="text-slate-400 mt-2">
            Add beautiful borders and mats to your images
          </p>
        </header>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Left Panel - Controls */}
          <div className="space-y-6">
            {/* Upload Section */}
            <div
              className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700/50 backdrop-blur-sm"
              onDrop={handleDrop}
              onDragOver={handleDragOver}
            >
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <svg
                  className="w-5 h-5 text-blue-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                Upload Image
              </h2>

              {/* File Upload */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-600 rounded-xl p-8 text-center cursor-pointer hover:border-blue-500 hover:bg-slate-700/30 transition-all duration-200"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <svg
                  className="w-12 h-12 mx-auto text-slate-500 mb-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
                <p className="text-slate-400">
                  Click to upload, drag & drop, or paste an image
                </p>
                <p className="text-slate-500 text-sm mt-1">
                  PNG, JPG, WEBP supported
                </p>
              </div>

              {/* URL Input */}
              <div className="mt-4 flex gap-2">
                <input
                  type="url"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="Or paste an image URL..."
                  className="flex-1 bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-2 text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  onKeyDown={(e) => e.key === "Enter" && handleUrlSubmit()}
                />
                <button
                  onClick={handleUrlSubmit}
                  disabled={isLoading || !urlInput.trim()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed rounded-lg transition-colors"
                >
                  Load
                </button>
              </div>

              {error && (
                <p className="mt-3 text-red-400 text-sm">{error}</p>
              )}
            </div>

            {/* Border Controls */}
            <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700/50 backdrop-blur-sm">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <svg
                  className="w-5 h-5 text-purple-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"
                  />
                </svg>
                Border Settings
              </h2>

              {/* Outer Border */}
              <div className="space-y-4">
                <div>
                  <label className="flex items-center justify-between mb-2">
                    <span className="text-slate-300">Outer Border Width</span>
                    <span className="text-slate-400 text-sm">
                      {borderSettings.outerWidth}px
                    </span>
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="200"
                    value={borderSettings.outerWidth}
                    onChange={(e) =>
                      setBorderSettings((prev) => ({
                        ...prev,
                        outerWidth: parseInt(e.target.value),
                      }))
                    }
                    className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 mb-2">
                    Outer Border Color
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={borderSettings.outerColor}
                      onChange={(e) =>
                        setBorderSettings((prev) => ({
                          ...prev,
                          outerColor: e.target.value,
                        }))
                      }
                      className="w-12 h-10 rounded-lg cursor-pointer bg-transparent border border-slate-600"
                    />
                    <input
                      type="text"
                      value={borderSettings.outerColor}
                      onChange={(e) =>
                        setBorderSettings((prev) => ({
                          ...prev,
                          outerColor: e.target.value,
                        }))
                      }
                      className="flex-1 bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2 text-white font-mono text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Inner Border */}
              <div className="mt-6 pt-6 border-t border-slate-700">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-slate-300">Inner Border</span>
                  <button
                    onClick={() =>
                      setBorderSettings((prev) => ({
                        ...prev,
                        showInner: !prev.showInner,
                      }))
                    }
                    className={`relative w-12 h-6 rounded-full transition-colors ${
                      borderSettings.showInner
                        ? "bg-blue-600"
                        : "bg-slate-600"
                    }`}
                  >
                    <span
                      className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                        borderSettings.showInner
                          ? "left-7"
                          : "left-1"
                      }`}
                    />
                  </button>
                </div>

                {borderSettings.showInner && (
                  <div className="space-y-4">
                    <div>
                      <label className="flex items-center justify-between mb-2">
                        <span className="text-slate-300">Inner Border Width</span>
                        <span className="text-slate-400 text-sm">
                          {borderSettings.innerWidth}px
                        </span>
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={borderSettings.innerWidth}
                        onChange={(e) =>
                          setBorderSettings((prev) => ({
                            ...prev,
                            innerWidth: parseInt(e.target.value),
                          }))
                        }
                        className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-300 mb-2">
                        Inner Border Color
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="color"
                          value={borderSettings.innerColor}
                          onChange={(e) =>
                            setBorderSettings((prev) => ({
                              ...prev,
                              innerColor: e.target.value,
                            }))
                          }
                          className="w-12 h-10 rounded-lg cursor-pointer bg-transparent border border-slate-600"
                        />
                        <input
                          type="text"
                          value={borderSettings.innerColor}
                          onChange={(e) =>
                            setBorderSettings((prev) => ({
                              ...prev,
                              innerColor: e.target.value,
                            }))
                          }
                          className="flex-1 bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2 text-white font-mono text-sm"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Download Button */}
            {image && (
              <button
                onClick={handleDownload}
                className="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 rounded-xl font-semibold transition-all duration-200 flex items-center justify-center gap-2"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                  />
                </svg>
                Download Matted Image
              </button>
            )}
          </div>

          {/* Right Panel - Preview */}
          <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700/50 backdrop-blur-sm">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <svg
                className="w-5 h-5 text-green-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                />
              </svg>
              Preview
            </h2>

            <div className="flex items-center justify-center min-h-[400px] bg-slate-900/50 rounded-xl overflow-hidden">
              {isLoading ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  <p className="text-slate-400">Loading image...</p>
                </div>
              ) : image ? (
                <canvas
                  ref={canvasRef}
                  className="max-w-full max-h-[600px] object-contain shadow-2xl"
                />
              ) : (
                <div className="text-center text-slate-500">
                  <svg
                    className="w-16 h-16 mx-auto mb-3 opacity-50"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                  <p>No image loaded</p>
                  <p className="text-sm mt-1">
                    Upload an image to see the preview
                  </p>
                </div>
              )}
            </div>

            {image && (
              <div className="mt-4 text-sm text-slate-400 flex items-center justify-between">
                <span>
                  Original: {image.width} × {image.height}px
                </span>
                {image.orientation !== 1 && (
                  <span className="text-blue-400">
                    EXIF Orientation: {image.orientation}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-12 text-center text-slate-500 text-sm">
          <p>
            Tip: You can also paste images directly (Ctrl/Cmd + V) or drag &
            drop
          </p>
        </footer>
      </div>
    </main>
  );
}
