import { describe, test, expect } from "bun:test";
import { parseInput, unitMap, volumeUnits } from "../converter-utils";

describe("unitMap", () => {
  test("maps volume aliases", () => {
    expect(unitMap["cup"]).toBe("cup");
    expect(unitMap["cups"]).toBe("cup");
    expect(unitMap["ml"]).toBe("ml");
    expect(unitMap["milliliter"]).toBe("ml");
    expect(unitMap["milliliters"]).toBe("ml");
    expect(unitMap["liter"]).toBe("l");
    expect(unitMap["liters"]).toBe("l");
    expect(unitMap["gallon"]).toBe("gal");
    expect(unitMap["gallons"]).toBe("gal");
    expect(unitMap["pint"]).toBe("pnt");
    expect(unitMap["quart"]).toBe("qt");
    expect(unitMap["tablespoon"]).toBe("tbs");
    expect(unitMap["teaspoon"]).toBe("tsp");
    expect(unitMap["fl-oz"]).toBe("fl-oz");
    expect(unitMap["floz"]).toBe("fl-oz");
    expect(unitMap["fluidounces"]).toBe("fl-oz");
  });

  test("maps mass/weight aliases", () => {
    expect(unitMap["g"]).toBe("g");
    expect(unitMap["gram"]).toBe("g");
    expect(unitMap["kg"]).toBe("kg");
    expect(unitMap["kilogram"]).toBe("kg");
    expect(unitMap["oz"]).toBe("oz");
    expect(unitMap["ounce"]).toBe("oz");
    expect(unitMap["ounces"]).toBe("oz");
    expect(unitMap["lb"]).toBe("lb");
    expect(unitMap["pound"]).toBe("lb");
    expect(unitMap["pounds"]).toBe("lb");
  });

  test("maps length aliases", () => {
    expect(unitMap["mm"]).toBe("mm");
    expect(unitMap["millimeter"]).toBe("mm");
    expect(unitMap["cm"]).toBe("cm");
    expect(unitMap["m"]).toBe("m");
    expect(unitMap["meter"]).toBe("m");
    expect(unitMap["km"]).toBe("km");
    expect(unitMap["inch"]).toBe("in");
    expect(unitMap["inches"]).toBe("in");
    expect(unitMap["foot"]).toBe("ft");
    expect(unitMap["feet"]).toBe("ft");
    expect(unitMap["yard"]).toBe("yd");
    expect(unitMap["mile"]).toBe("mi");
  });

  test("maps temperature aliases", () => {
    expect(unitMap["c"]).toBe("C");
    expect(unitMap["celsius"]).toBe("C");
    expect(unitMap["f"]).toBe("F");
    expect(unitMap["fahrenheit"]).toBe("F");
    expect(unitMap["k"]).toBe("K");
    expect(unitMap["kelvin"]).toBe("K");
  });

  test("does not contain unknown aliases", () => {
    expect(unitMap["fathom"]).toBeUndefined();
    expect(unitMap["stone"]).toBeUndefined();
    expect(unitMap[""]).toBeUndefined();
  });
});

describe("volumeUnits", () => {
  test("contains expected volume units", () => {
    expect(volumeUnits.has("ml")).toBe(true);
    expect(volumeUnits.has("l")).toBe(true);
    expect(volumeUnits.has("cup")).toBe(true);
    expect(volumeUnits.has("gal")).toBe(true);
    expect(volumeUnits.has("pnt")).toBe(true);
    expect(volumeUnits.has("qt")).toBe(true);
    expect(volumeUnits.has("fl-oz")).toBe(true);
    expect(volumeUnits.has("tbs")).toBe(true);
    expect(volumeUnits.has("tsp")).toBe(true);
  });

  test("does not contain non-volume units", () => {
    expect(volumeUnits.has("kg")).toBe(false);
    expect(volumeUnits.has("lb")).toBe(false);
    expect(volumeUnits.has("m")).toBe(false);
    expect(volumeUnits.has("C")).toBe(false);
    expect(volumeUnits.has("oz")).toBe(false);
  });
});

describe("parseInput", () => {
  test("parses natural language input", () => {
    expect(parseInput("9 cups to ml", "", "")).toEqual({
      value: 9,
      from: "cup",
      to: "ml",
    });
  });

  test("parses decimal values", () => {
    expect(parseInput("2.5 liters to gallons", "", "")).toEqual({
      value: 2.5,
      from: "l",
      to: "gal",
    });
  });

  test("is case insensitive", () => {
    expect(parseInput("1 Cup To ML", "", "")).toEqual({
      value: 1,
      from: "cup",
      to: "ml",
    });
  });

  test("handles multi-word unit names", () => {
    expect(parseInput("3 tablespoons to teaspoons", "", "")).toEqual({
      value: 3,
      from: "tbs",
      to: "tsp",
    });
  });

  test("handles abbreviation aliases", () => {
    expect(parseInput("1 kg to lb", "", "")).toEqual({
      value: 1,
      from: "kg",
      to: "lb",
    });
  });

  test("parses just a number when fromUnit and toUnit provided", () => {
    expect(parseInput("100", "ml", "cup")).toEqual({
      value: 100,
      from: "ml",
      to: "cup",
    });
  });

  test("disambiguates oz to fl-oz when from unit is volume", () => {
    expect(parseInput("8 cups to oz", "", "")).toEqual({
      value: 8,
      from: "cup",
      to: "fl-oz",
    });
  });

  test("disambiguates oz to fl-oz in numeric mode when fromUnit is volume", () => {
    expect(parseInput("8", "cup", "oz")).toEqual({
      value: 8,
      from: "cup",
      to: "fl-oz",
    });
  });

  test("keeps oz as weight when from unit is not volume", () => {
    expect(parseInput("2 lb to oz", "", "")).toEqual({
      value: 2,
      from: "lb",
      to: "oz",
    });
  });

  test("returns null for empty input", () => {
    expect(parseInput("", "", "")).toBeNull();
  });

  test("returns null for whitespace-only input", () => {
    expect(parseInput("   ", "", "")).toBeNull();
  });

  test("returns null for unknown units in natural language", () => {
    expect(parseInput("5 fathoms to leagues", "", "")).toBeNull();
  });

  test("returns null for just a number without unit selectors", () => {
    expect(parseInput("42", "", "")).toBeNull();
  });

  test("returns null for just a number with only fromUnit", () => {
    expect(parseInput("42", "ml", "")).toBeNull();
  });

  test("returns null for just a number with only toUnit", () => {
    expect(parseInput("42", "", "cup")).toBeNull();
  });

  test("handles temperature conversions", () => {
    expect(parseInput("100 c to f", "", "")).toEqual({
      value: 100,
      from: "C",
      to: "F",
    });
  });

  test("handles length conversions", () => {
    expect(parseInput("1 mile to km", "", "")).toEqual({
      value: 1,
      from: "mi",
      to: "km",
    });
  });

  test("handles mixed-case with leading/trailing whitespace", () => {
    expect(parseInput("  5 Liters to Cups  ", "", "")).toEqual({
      value: 5,
      from: "l",
      to: "cup",
    });
  });
});
