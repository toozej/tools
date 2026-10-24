"use client";

import { useMemo, useState } from "react";
import {
  calculateEstimate,
  formatMegabytes,
  formatRemainingCapacity,
  megapixelsFromDimensions,
  photoFormats,
  RAW_JPEG_FORMAT_ID,
  rawCompressionModes,
  rawFormats,
  type PixelShiftFrames,
  type RawCompressionMode,
} from "@/lib/estimator";

type InputMode = "megapixels" | "dimensions";

const formatGroups = ["Compressed", "Camera RAW"] as const;

export default function MemoryCardEstimator() {
  const [inputMode, setInputMode] = useState<InputMode>("megapixels");
  const [megapixelsValue, setMegapixelsValue] = useState("24");
  const [widthValue, setWidthValue] = useState("6000");
  const [heightValue, setHeightValue] = useState("4000");
  const [formatId, setFormatId] = useState("jpeg");
  const [rawFormatId, setRawFormatId] = useState("cr3");
  const [rawCompressionMode, setRawCompressionMode] = useState<RawCompressionMode>("lossless");
  const [pixelShiftFrames, setPixelShiftFrames] = useState<PixelShiftFrames>(4);
  const [capacityValue, setCapacityValue] = useState("64");
  const [capacityUnit, setCapacityUnit] = useState<"MB" | "GB">("GB");
  const isRawJpeg = formatId === RAW_JPEG_FORMAT_ID;
  const selectedRawFormatId = isRawJpeg ? rawFormatId : formatId;
  const isArq = selectedRawFormatId === "arq";
  const usesRawFormat = isRawJpeg || rawFormats.some((format) => format.id === formatId);

  const estimate = useMemo(() => {
    const megapixels = inputMode === "megapixels"
      ? Number.parseFloat(megapixelsValue)
      : megapixelsFromDimensions(Number.parseFloat(widthValue), Number.parseFloat(heightValue));

    if (megapixels === null || !Number.isFinite(megapixels)) return null;

    return calculateEstimate({
      megapixels,
      capacityValue: Number.parseFloat(capacityValue),
      capacityUnit,
      formatId,
      rawFormatId: isRawJpeg ? rawFormatId : undefined,
      rawCompressionMode,
      pixelShiftFrames,
    });
  }, [capacityUnit, capacityValue, formatId, heightValue, inputMode, isRawJpeg, megapixelsValue, pixelShiftFrames, rawCompressionMode, rawFormatId, widthValue]);

  return (
    <div className="w-full max-w-5xl overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_28px_80px_rgba(15,23,42,0.12)] dark:border-slate-700 dark:bg-slate-900 dark:shadow-black/30">
      <div className="grid lg:grid-cols-[1.05fr_0.95fr]">
        <section className="p-6 sm:p-9 lg:p-11" aria-labelledby="estimator-heading">
          <div className="mb-8">
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-teal-700 dark:text-teal-300">
              Camera storage planner
            </p>
            <h1 id="estimator-heading" className="text-3xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-4xl">
              Memory card photo estimator
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600 dark:text-slate-300">
              Estimate how many photos fit on a card from image resolution and file format.
            </p>
          </div>

          <div className="space-y-7">
            <fieldset>
              <legend className="mb-3 text-sm font-semibold text-slate-800 dark:text-slate-100">Image resolution</legend>
              <div className="grid grid-cols-2 rounded-xl bg-slate-100 p-1 dark:bg-slate-800" aria-label="Resolution input type">
                <button
                  type="button"
                  aria-pressed={inputMode === "megapixels"}
                  onClick={() => setInputMode("megapixels")}
                  className={`rounded-lg px-3 py-2.5 text-sm font-semibold transition ${inputMode === "megapixels" ? "bg-white text-slate-950 shadow-sm dark:bg-slate-700 dark:text-white" : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"}`}
                >
                  Megapixels
                </button>
                <button
                  type="button"
                  aria-pressed={inputMode === "dimensions"}
                  onClick={() => setInputMode("dimensions")}
                  className={`rounded-lg px-3 py-2.5 text-sm font-semibold transition ${inputMode === "dimensions" ? "bg-white text-slate-950 shadow-sm dark:bg-slate-700 dark:text-white" : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"}`}
                >
                  Pixel dimensions
                </button>
              </div>

              {inputMode === "megapixels" ? (
                <div className="mt-4">
                  <label htmlFor="megapixels" className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Sensor resolution</label>
                  <div className="relative">
                    <input
                      id="megapixels"
                      type="number"
                      min="0.01"
                      step="any"
                      inputMode="decimal"
                      value={megapixelsValue}
                      onChange={(event) => setMegapixelsValue(event.target.value)}
                      className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 pr-16 text-base text-slate-950 outline-none transition focus:border-teal-600 focus:ring-4 focus:ring-teal-600/10 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                    />
                    <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm text-slate-500">MP</span>
                  </div>
                </div>
              ) : (
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="width" className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Width (px)</label>
                    <input
                      id="width"
                      type="number"
                      min="1"
                      step="1"
                      inputMode="numeric"
                      value={widthValue}
                      onChange={(event) => setWidthValue(event.target.value)}
                      className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-950 outline-none transition focus:border-teal-600 focus:ring-4 focus:ring-teal-600/10 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                  <div>
                    <label htmlFor="height" className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Height (px)</label>
                    <input
                      id="height"
                      type="number"
                      min="1"
                      step="1"
                      inputMode="numeric"
                      value={heightValue}
                      onChange={(event) => setHeightValue(event.target.value)}
                      className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-950 outline-none transition focus:border-teal-600 focus:ring-4 focus:ring-teal-600/10 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                  <p className="col-span-2 text-xs text-slate-500 dark:text-slate-400">
                    Enter the image width and height in pixels.
                  </p>
                </div>
              )}
            </fieldset>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="format" className="mb-2 block text-sm font-semibold text-slate-800 dark:text-slate-100">File format</label>
                <select
                  id="format"
                  value={formatId}
                  onChange={(event) => setFormatId(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-950 outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-600/10 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                >
                  <optgroup label="Combined capture">
                    <option value={RAW_JPEG_FORMAT_ID}>RAW + JPG pair</option>
                  </optgroup>
                  {formatGroups.map((group) => (
                    <optgroup key={group} label={group}>
                      {photoFormats.filter((format) => format.group === group).map((format) => (
                        <option key={format.id} value={format.id}>{format.label}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              {formatId === RAW_JPEG_FORMAT_ID && (
                <div>
                  <label htmlFor="raw-format" className="mb-2 block text-sm font-semibold text-slate-800 dark:text-slate-100">RAW file type</label>
                  <select
                    id="raw-format"
                    value={rawFormatId}
                    onChange={(event) => setRawFormatId(event.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-950 outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-600/10 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                  >
                    {rawFormats.filter((format) => format.id !== "arq").map((format) => (
                      <option key={format.id} value={format.id}>{format.label}</option>
                    ))}
                  </select>
                </div>
              )}

              {usesRawFormat && !isArq && (
                <div>
                  <label htmlFor="raw-compression" className="mb-2 block text-sm font-semibold text-slate-800 dark:text-slate-100">RAW compression</label>
                  <select
                    id="raw-compression"
                    value={rawCompressionMode}
                    onChange={(event) => setRawCompressionMode(event.target.value as RawCompressionMode)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-950 outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-600/10 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                  >
                    {rawCompressionModes.map((mode) => (
                      <option key={mode.id} value={mode.id}>{mode.label}</option>
                    ))}
                  </select>
                </div>
              )}

              {isArq && (
                <div>
                  <label htmlFor="pixel-shift-frames" className="mb-2 block text-sm font-semibold text-slate-800 dark:text-slate-100">Pixel-shift RAW frames</label>
                  <select
                    id="pixel-shift-frames"
                    value={pixelShiftFrames}
                    onChange={(event) => setPixelShiftFrames(Number(event.target.value) as PixelShiftFrames)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-950 outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-600/10 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                  >
                    <option value={4}>4 frames</option>
                    <option value={16}>16 frames</option>
                  </select>
                </div>
              )}

              <div>
                <label htmlFor="capacity" className="mb-2 block text-sm font-semibold text-slate-800 dark:text-slate-100">Card capacity</label>
                <div className="flex rounded-xl border border-slate-300 bg-white focus-within:border-teal-600 focus-within:ring-4 focus-within:ring-teal-600/10 dark:border-slate-600 dark:bg-slate-800">
                  <input
                    id="capacity"
                    type="number"
                    min="0.01"
                    step="any"
                    inputMode="decimal"
                    value={capacityValue}
                    onChange={(event) => setCapacityValue(event.target.value)}
                    className="min-w-0 flex-1 rounded-l-xl bg-transparent px-4 py-3 text-base text-slate-950 outline-none dark:text-white"
                  />
                  <select
                    aria-label="Card capacity unit"
                    value={capacityUnit}
                    onChange={(event) => setCapacityUnit(event.target.value as "MB" | "GB")}
                    className="rounded-r-xl border-l border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-700 outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
                  >
                    <option value="GB">GB</option>
                    <option value="MB">MB</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="flex flex-col justify-between bg-slate-950 p-6 text-white sm:p-9 lg:p-11" aria-labelledby="result-heading" aria-live="polite">
          <div>
            <div className="mb-8 flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-teal-300">Estimated card fit</p>
                <h2 id="result-heading" className="mt-2 text-lg font-semibold text-white">Photo capacity</h2>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5" aria-hidden="true">
                <svg viewBox="0 0 24 24" className="h-6 w-6 text-teal-300" fill="none" stroke="currentColor" strokeWidth="1.7">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 5.75A1.75 1.75 0 0 1 6.75 4h8.5L19 7.75v10.5A1.75 1.75 0 0 1 17.25 20h-10.5A1.75 1.75 0 0 1 5 18.25V5.75Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 4v4h6V4m-6 9h6m-6 3h6" />
                </svg>
              </div>
            </div>

            {estimate ? (
              <>
                <p className="text-5xl font-bold tracking-tight sm:text-6xl">
                  {estimate.photoCount.toLocaleString()}
                </p>
                <p className="mt-2 text-sm text-slate-300">
                  {isArq ? "estimated pixel-shift sets on this card" : "estimated photos on this card"}
                </p>

                <div className="mt-9 space-y-4 border-t border-white/10 pt-6">
                  <div className="flex items-center justify-between gap-4 text-sm">
                    <span className="text-slate-300">
                      {isArq
                        ? "Estimated size per pixel-shift set"
                        : isRawJpeg
                          ? "Estimated size per RAW + JPG pair"
                          : "Estimated size per photo"}
                    </span>
                    <span className="font-semibold text-white">{formatMegabytes(estimate.photoSizeMegabytes)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4 text-sm">
                    <span className="text-slate-300">Card space used</span>
                    <span className="font-semibold text-white">{formatRemainingCapacity(estimate.usedMegabytes)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4 text-sm">
                    <span className="text-slate-300">Estimated space left</span>
                    <span className="font-semibold text-teal-300">{formatRemainingCapacity(estimate.remainingMegabytes)}</span>
                  </div>
                </div>
              </>
            ) : (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-sm leading-6 text-slate-300">
                Enter a positive image resolution and card capacity to see an estimate.
              </div>
            )}
          </div>

          <div className="mt-10 rounded-2xl border border-teal-300/20 bg-teal-300/10 p-4 text-xs leading-5 text-teal-50/90">
            {isArq
              ? `ARQ estimates ${pixelShiftFrames} uncompressed source RAW frames per set. Sony creates the combined ARQ file on a computer.`
              : usesRawFormat
                ? "RAW estimates use a 14-bit uncompressed baseline of 1.75 MB per megapixel and a format-specific compression estimate. RAW + JPG counts both files per shot."
                : "File sizes are averages. Camera settings, image content, and compression can change the actual size."}
            {" "}GB uses 1,000 MB.
          </div>
        </section>
      </div>
    </div>
  );
}
