export const volumeUnits = new Set(['ml', 'l', 'cup', 'gal', 'pnt', 'qt', 'fl-oz', 'tbs', 'tsp']);

export const unitMap: Record<string, string> = {
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
  'c': 'C',
  'celsius': 'C',
  'f': 'F',
  'fahrenheit': 'F',
  'k': 'K',
  'kelvin': 'K',
};

export function parseInput(input: string, fromUnit: string, toUnit: string) {
  const trimmedInput = input.trim();
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
