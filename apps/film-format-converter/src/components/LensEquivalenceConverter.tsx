"use client";

import { useState, useMemo } from 'react';
import { filmFormats, calculateCropFactor, convertFocalLength, FilmFormat } from '@/lib/film-formats';

export default function LensEquivalenceConverter() {
  const [focalLength, setFocalLength] = useState<string>('50');
  const [fromFormat, setFromFormat] = useState<string>('aps-c');
  const [toFormat, setToFormat] = useState<string>('fullframe');



  const getSortedFormats = useMemo(() => {
    return [...filmFormats].sort((a, b) => 
      (a.width * a.height) - (b.width * b.height)
    );
  }, []);

  const groupedFormats = useMemo(() => {
    const groups: Record<string, FilmFormat[]> = {
      'Video / Motion Picture': getSortedFormats.filter(f => f.category === 'video'),
      'Digital Sensors': getSortedFormats.filter(f => f.category === 'photo-digital'),
      'Analog Film': getSortedFormats.filter(f => f.category === 'photo-film'),
    };
    return groups;
  }, [getSortedFormats]);

  const fromFormatData = filmFormats.find(f => f.id === fromFormat);
  const toFormatData = filmFormats.find(f => f.id === toFormat);

  const equivalentFocalLength = useMemo(() => {
    if (!fromFormatData || !toFormatData || !focalLength) return null;
    return convertFocalLength(parseFloat(focalLength), fromFormatData, toFormatData);
  }, [focalLength, fromFormatData, toFormatData]);

  const cropFrom = fromFormatData ? calculateCropFactor(fromFormatData) : 0;
  const cropTo = toFormatData ? calculateCropFactor(toFormatData) : 0;

  return (
    <div className="max-w-2xl w-full mx-auto p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
      <h1 className="text-2xl font-bold mb-6 text-center text-gray-900 dark:text-white">
        Lens Focal Length Equivalence
      </h1>

      <div className="space-y-5">
        <div>
          <label htmlFor="focalLength" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Focal Length (mm)
          </label>
          <input
            id="focalLength"
            type="number"
            min="1"
            step="0.1"
            value={focalLength}
            onChange={(e) => setFocalLength(e.target.value)}
            className="w-full px-4 py-3 text-lg border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="fromFormat" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Source Format
            </label>
            <select
              id="fromFormat"
              value={fromFormat}
              onChange={(e) => setFromFormat(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
            >
              {Object.entries(groupedFormats).map(([group, formats]) => (
                <optgroup key={group} label={group}>
                  {formats.map((format) => (
                    <option key={format.id} value={format.id}>
                      {format.name} ({format.width}×{format.height}mm)
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="toFormat" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Target Format
            </label>
            <select
              id="toFormat"
              value={toFormat}
              onChange={(e) => setToFormat(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
            >
              {Object.entries(groupedFormats).map(([group, formats]) => (
                <optgroup key={group} label={group}>
                  {formats.map((format) => (
                    <option key={format.id} value={format.id}>
                      {format.name} ({format.width}×{format.height}mm)
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
        </div>

        {equivalentFocalLength && fromFormatData && toFormatData && (
          <div className="mt-6 p-5 bg-blue-50 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-700 rounded-lg">
            <div className="text-center">
              <div className="text-lg text-gray-600 dark:text-gray-300 mb-1">
                {focalLength}mm on <span className="font-medium">{fromFormatData.name}</span>
              </div>
              <div className="text-gray-400 dark:text-gray-500 mb-3">is equivalent to</div>
              <div className="text-4xl font-bold text-blue-700 dark:text-blue-300">
                {equivalentFocalLength.toFixed(1)}mm
              </div>
              <div className="text-lg text-gray-600 dark:text-gray-300 mt-1">
                on <span className="font-medium">{toFormatData.name}</span>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-4 text-sm text-gray-600 dark:text-gray-400">
              <div className="text-center p-2 bg-white dark:bg-gray-800 rounded">
                <div className="font-medium">Source Crop Factor</div>
                <div className="text-xl">{cropFrom.toFixed(2)}x</div>
              </div>
              <div className="text-center p-2 bg-white dark:bg-gray-800 rounded">
                <div className="font-medium">Target Crop Factor</div>
                <div className="text-xl">{cropTo.toFixed(2)}x</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}