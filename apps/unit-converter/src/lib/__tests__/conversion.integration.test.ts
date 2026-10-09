import { describe, expect, test } from "bun:test";
import convert, { type Unit } from "convert-units";
import { parseInput } from "../converter-utils";

function convertInput(input: string) {
  const parsed = parseInput(input, "", "");
  if (!parsed) throw new Error(`Could not parse: ${input}`);
  return convert(parsed.value).from(parsed.from as Unit).to(parsed.to as Unit);
}

describe("natural language conversion", () => {
  test("converts the example shown in the input", () => {
    expect(convertInput("9 cups to ml")).toBeCloseTo(2129.29, 2);
  });

  test("converts abbreviated volume units", () => {
    expect(convertInput("1 gal to qt")).toBeCloseTo(4);
    expect(convertInput("8 oz to cups")).toBeCloseTo(1);
    expect(convertInput("8 fl-oz to cups")).toBeCloseTo(1);
  });

  test("converts a negative temperature", () => {
    expect(convertInput("-40 c to f")).toBeCloseTo(-40);
  });
});
