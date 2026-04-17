import { describe, test, expect } from "bun:test";
import { calculateCropFactor, convertFocalLength, filmFormats } from '../film-formats';

describe("filmFormats database", () => {
  test("has all required formats", () => {
    const ids = filmFormats.map(f => f.id);
    expect(ids).toContain('fullframe');
    expect(ids).toContain('aps-c');
    expect(ids).toContain('micro-four-thirds');
    expect(ids).toContain('super8');
    expect(ids).toContain('16mm');
    expect(ids).toContain('35mm');
    expect(ids).toContain('120-645');
    expect(ids).toContain('4x5');
  });

  test("full frame dimensions are correct", () => {
    const fullframe = filmFormats.find(f => f.id === 'fullframe')!;
    expect(fullframe.width).toBe(36.0);
    expect(fullframe.height).toBe(24.0);
  });

  test("dx/aps-c dimensions are correct", () => {
    const apsc = filmFormats.find(f => f.id === 'aps-c')!;
    expect(apsc.width).toBe(23.6);
    expect(apsc.height).toBe(15.6);
  });
});

describe("calculateCropFactor", () => {
  test("full frame crop factor is 1.0", () => {
    const fullframe = filmFormats.find(f => f.id === 'fullframe')!;
    expect(calculateCropFactor(fullframe)).toBeCloseTo(1.0);
  });

  test("APS-C DX crop factor is ~1.5x", () => {
    const apsc = filmFormats.find(f => f.id === 'aps-c')!;
    expect(calculateCropFactor(apsc)).toBeCloseTo(1.52, 1);
  });

  test("Micro Four Thirds crop factor is 2.0x", () => {
    const mft = filmFormats.find(f => f.id === 'micro-four-thirds')!;
    expect(calculateCropFactor(mft)).toBeCloseTo(2.0, 1);
  });

  test("Nikon 1 crop factor is ~2.7x", () => {
    const nikon1 = filmFormats.find(f => f.id === 'nikon1')!;
    expect(calculateCropFactor(nikon1)).toBeCloseTo(2.7, 1);
  });
});

describe("convertFocalLength", () => {
  test("50mm APS-C → 75mm full frame", () => {
    const apsc = filmFormats.find(f => f.id === 'aps-c')!;
    const fullframe = filmFormats.find(f => f.id === 'fullframe')!;
    const result = convertFocalLength(50, apsc, fullframe);
    expect(result).toBeCloseTo(76, 0);
  });

  test("50mm full frame → 33mm APS-C", () => {
    const apsc = filmFormats.find(f => f.id === 'aps-c')!;
    const fullframe = filmFormats.find(f => f.id === 'fullframe')!;
    const result = convertFocalLength(50, fullframe, apsc);
    expect(result).toBeCloseTo(33, 0);
  });

  test("50mm full frame → 25mm MFT", () => {
    const mft = filmFormats.find(f => f.id === 'micro-four-thirds')!;
    const fullframe = filmFormats.find(f => f.id === 'fullframe')!;
    const result = convertFocalLength(50, fullframe, mft);
    expect(result).toBeCloseTo(25, 0);
  });

  test("25mm MFT → 50mm full frame", () => {
    const mft = filmFormats.find(f => f.id === 'micro-four-thirds')!;
    const fullframe = filmFormats.find(f => f.id === 'fullframe')!;
    const result = convertFocalLength(25, mft, fullframe);
    expect(result).toBeCloseTo(50, 0);
  });

  test("same format returns same focal length", () => {
    const fullframe = filmFormats.find(f => f.id === 'fullframe')!;
    const result = convertFocalLength(50, fullframe, fullframe);
    expect(result).toBe(50);
  });

  test("supports floating point focal lengths", () => {
    const apsc = filmFormats.find(f => f.id === 'aps-c')!;
    const fullframe = filmFormats.find(f => f.id === 'fullframe')!;
    const result = convertFocalLength(35.5, apsc, fullframe);
    expect(result).toBeCloseTo(54, 0);
  });
});
