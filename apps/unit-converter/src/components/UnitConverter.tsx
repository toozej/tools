"use client";

import { useState } from 'react';
import convert from 'convert-units';

const volumeUnits = new Set(['ml', 'l', 'cup', 'gal', 'pnt', 'qt', 'fl-oz', 'tbs', 'tsp']);

const unitMap: Record<string, string> = {
  // Volume
  'cup': 'cup',
  'cups': 'cup',
  'ml': 'ml',
  'milliliter': 'ml',
  'milliliters': 'ml',
  'millilitre': 'ml',
  'millilitres': 'ml',
  'l': 'l',
  'liter': 'l',
  'liters': 'l',
  'litre': 'l',
  'litres': 'l',
  'gallon': 'gal',
  'gallons': 'gal',
  'gals': 'gal',
  'pint': 'pnt',
  'pints': 'pnt',
  'pt': 'pnt',
  'pts': 'pnt',
  'quart': 'qt',
  'quarts': 'qt',
  'qts': 'qt',
  'floz': 'fl-oz',
  'fl-oz': 'fl-oz',
  'fluidounce': 'fl-oz',
  'fluidounces': 'fl-oz',
  'tablespoon': 'tbs',
  'tablespoons': 'tbs',
  'tbsp': 'tbs',
  'teaspoon': 'tsp',
  'teaspoons': 'tsp',
  // Length
  'mm': 'mm',
  'millimeter': 'mm',
  'millimeters': 'mm',
  'cm': 'cm',
  'centimeter': 'cm',
  'centimeters': 'cm',
  'm': 'm',
  'meter': 'm',
  'meters': 'm',
  'km': 'km',
  'kilometer': 'km',
  'kilometers': 'km',
  'inch': 'in',
  'inches': 'in',
  'in': 'in',
  'foot': 'ft',
  'feet': 'ft',
  'ft': 'ft',
  'yard': 'yd',
  'yards': 'yd',
  'yd': 'yd',
  'mile': 'mi',
  'miles': 'mi',
  'mi': 'mi',
  // Mass
  'g': 'g',
  'gram': 'g',
  'grams': 'g',
  'kg': 'kg',
  'kilogram': 'kg',
  'kilograms': 'kg',
  'oz': 'oz',
  'ounce': 'oz',
  'ounces': 'oz',
  'lb': 'lb',
  'pound': 'lb',
  'pounds': 'lb',
  // Temperature
  'c': 'C',
  'celsius': 'C',
  'f': 'F',
  'fahrenheit': 'F',
  'k': 'K',
  'kelvin': 'K',
};

const unitOptions = [
  { label: 'Milliliter (ml)', value: 'ml' },
  { label: 'Liter (l)', value: 'l' },
  { label: 'Cup (cup)', value: 'cup' },
  { label: 'Gallon (gal)', value: 'gal' },
  { label: 'Pint (pnt)', value: 'pnt' },
  { label: 'Quart (qt)', value: 'qt' },
  { label: 'Fluid Ounce (fl-oz)', value: 'fl-oz' },
  { label: 'Tablespoon (tbs)', value: 'tbs' },
  { label: 'Teaspoon (tsp)', value: 'tsp' },
  { label: 'Millimeter (mm)', value: 'mm' },
  { label: 'Centimeter (cm)', value: 'cm' },
  { label: 'Meter (m)', value: 'm' },
  { label: 'Kilometer (km)', value: 'km' },
  { label: 'Inch (in)', value: 'in' },
  { label: 'Foot (ft)', value: 'ft' },
  { label: 'Yard (yd)', value: 'yd' },
  { label: 'Mile (mi)', value: 'mi' },
  { label: 'Gram (g)', value: 'g' },
  { label: 'Kilogram (kg)', value: 'kg' },
  { label: 'Ounce (oz)', value: 'oz' },
  { label: 'Pound (lb)', value: 'lb' },
  { label: 'Celsius (C)', value: 'C' },
  { label: 'Fahrenheit (F)', value: 'F' },
  { label: 'Kelvin (K)', value: 'K' },
];

function parseInput(input: string, fromUnit: string, toUnit: string) {
  const trimmedInput = input.trim();
  // Full natural language: "9 cups to ml"
  const fullMatch = trimmedInput.match(/(\d+(?:\.\d+)?)\s*(\w+(?:\s+\w+)*)\s+to\s+(\w+(?:\s+\w+)*)/i);
  if (fullMatch) {
    const value = parseFloat(fullMatch[1]);
    const from = fullMatch[2].toLowerCase().replace(/\s+/g, '');
    const to = fullMatch[3].toLowerCase().replace(/\s+/g, '');
    const fromMapped = unitMap[from];
    let toMapped = unitMap[to];
    if (fromMapped && toMapped) {
      if (toMapped === 'oz' && volumeUnits.has(fromMapped)) {
        toMapped = 'fl-oz';
      }
      return { value, from: fromMapped, to: toMapped };
    }
  }
  // Just number, use dropdowns
  const numMatch = trimmedInput.match(/^(\d+(?:\.\d+)?)$/);
  if (numMatch && fromUnit && toUnit) {
    const value = parseFloat(numMatch[1]);
    let to = toUnit;
    if (to === 'oz' && volumeUnits.has(fromUnit)) {
      to = 'fl-oz';
    }
    return { value, from: fromUnit, to };
  }
  return null;
}

export default function UnitConverter() {
  const [input, setInput] = useState('');
  const [fromUnit, setFromUnit] = useState('');
  const [toUnit, setToUnit] = useState('');
  const [result, setResult] = useState('');
  const [error, setError] = useState('');

  const handleConvert = () => {
    const parsed = parseInput(input, fromUnit, toUnit);
    if (parsed) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const converted = convert(parsed.value).from(parsed.from as any).to(parsed.to as any);
        setResult(`${parsed.value} ${parsed.from} = ${converted.toFixed(2)} ${parsed.to}`);
        setError('');
      } catch {
        setError('Incompatible units or conversion error');
      }
    } else {
      setError('Invalid input. Use "value unit to unit" or enter value and select units.');
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
    setError('');
    setResult('');
  };

  return (
    <div className="max-w-md mx-auto p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
      <h1 className="text-2xl font-bold mb-6 text-center text-gray-900 dark:text-white">Unit Converter</h1>

      <div className="space-y-4">
        <div>
          <label htmlFor="input" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {`Enter conversion (e.g., "9 cups to ml") or just a number:`}
          </label>
          <input
            id="input"
            type="text"
            value={input}
            onChange={handleInputChange}
            placeholder="9 cups to ml"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
          />
        </div>

        <div className="flex flex-col sm:flex-row sm:space-x-4 space-y-4 sm:space-y-0">
          <div className="flex-1">
            <label htmlFor="fromUnit" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              From Unit (optional):
            </label>
            <select
              id="fromUnit"
              value={fromUnit}
              onChange={(e) => setFromUnit(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
            >
              <option value="">Select unit</option>
              {unitOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex-1">
            <label htmlFor="toUnit" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              To Unit (optional):
            </label>
            <select
              id="toUnit"
              value={toUnit}
              onChange={(e) => setToUnit(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
            >
              <option value="">Select unit</option>
              {unitOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          onClick={handleConvert}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
        >
          Convert
        </button>

        {result && (
          <div className="p-3 bg-green-100 dark:bg-green-800 border border-green-400 dark:border-green-600 text-green-700 dark:text-green-200 rounded-md">
            {result}
          </div>
        )}

        {error && (
          <div className="p-3 bg-red-100 dark:bg-red-800 border border-red-400 dark:border-red-600 text-red-700 dark:text-red-200 rounded-md">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}