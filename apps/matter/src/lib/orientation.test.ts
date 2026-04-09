import { describe, it, expect, beforeEach, vi } from "bun:test";
import {
  applyOrientation,
  isRotatedOrientation,
  getActualDimensions,
  calculateTotalDimensions,
} from "./orientation";

describe("orientation utilities", () => {
  describe("applyOrientation", () => {
    it("should apply identity transform for orientation 1", () => {
      const ctx = {
        transform: vi.fn(),
      } as unknown as CanvasRenderingContext2D;
      const originalTransform = ctx.transform;
      applyOrientation(ctx, 1, 100, 100);
      expect(ctx.transform).not.toHaveBeenCalled();
    });

    it("should apply horizontal flip for orientation 2", () => {
      const ctx = {
        transform: vi.fn(),
      } as unknown as CanvasRenderingContext2D;
      applyOrientation(ctx, 2, 100, 50);
      expect(ctx.transform).toHaveBeenCalledWith(-1, 0, 0, 1, 100, 0);
    });

    it("should apply 180 degree rotation for orientation 3", () => {
      const ctx = {
        transform: vi.fn(),
      } as unknown as CanvasRenderingContext2D;
      applyOrientation(ctx, 3, 100, 50);
      expect(ctx.transform).toHaveBeenCalledWith(-1, 0, 0, -1, 100, 50);
    });

    it("should apply vertical flip for orientation 4", () => {
      const ctx = {
        transform: vi.fn(),
      } as unknown as CanvasRenderingContext2D;
      applyOrientation(ctx, 4, 100, 50);
      expect(ctx.transform).toHaveBeenCalledWith(1, 0, 0, -1, 0, 50);
    });

    it("should apply transpose for orientation 5", () => {
      const ctx = {
        transform: vi.fn(),
      } as unknown as CanvasRenderingContext2D;
      applyOrientation(ctx, 5, 100, 50);
      expect(ctx.transform).toHaveBeenCalledWith(0, 1, 1, 0, 0, 0);
    });

    it("should apply 90 degree CW rotation for orientation 6", () => {
      const ctx = {
        transform: vi.fn(),
      } as unknown as CanvasRenderingContext2D;
      applyOrientation(ctx, 6, 100, 50);
      expect(ctx.transform).toHaveBeenCalledWith(0, 1, -1, 0, 50, 0);
    });

    it("should apply 90 degree CCW + flip for orientation 7", () => {
      const ctx = {
        transform: vi.fn(),
      } as unknown as CanvasRenderingContext2D;
      applyOrientation(ctx, 7, 100, 50);
      expect(ctx.transform).toHaveBeenCalledWith(0, -1, -1, 0, 50, 100);
    });

    it("should apply 90 degree CCW rotation for orientation 8", () => {
      const ctx = {
        transform: vi.fn(),
      } as unknown as CanvasRenderingContext2D;
      applyOrientation(ctx, 8, 100, 50);
      expect(ctx.transform).toHaveBeenCalledWith(0, -1, 1, 0, 0, 100);
    });
  });

  describe("isRotatedOrientation", () => {
    it("should return false for orientation 1", () => {
      expect(isRotatedOrientation(1)).toBe(false);
    });

    it("should return false for orientation 2", () => {
      expect(isRotatedOrientation(2)).toBe(false);
    });

    it("should return false for orientation 3", () => {
      expect(isRotatedOrientation(3)).toBe(false);
    });

    it("should return false for orientation 4", () => {
      expect(isRotatedOrientation(4)).toBe(false);
    });

    it("should return true for orientation 5", () => {
      expect(isRotatedOrientation(5)).toBe(true);
    });

    it("should return true for orientation 6", () => {
      expect(isRotatedOrientation(6)).toBe(true);
    });

    it("should return true for orientation 7", () => {
      expect(isRotatedOrientation(7)).toBe(true);
    });

    it("should return true for orientation 8", () => {
      expect(isRotatedOrientation(8)).toBe(true);
    });

    it("should return false for invalid orientation 0", () => {
      expect(isRotatedOrientation(0)).toBe(false);
    });

    it("should return false for invalid orientation 9", () => {
      expect(isRotatedOrientation(9)).toBe(false);
    });
  });

  describe("getActualDimensions", () => {
    it("should return original dimensions for orientation 1", () => {
      expect(getActualDimensions(100, 50, 1)).toEqual({ width: 100, height: 50 });
    });

    it("should return swapped dimensions for orientation 6", () => {
      expect(getActualDimensions(100, 50, 6)).toEqual({ width: 50, height: 100 });
    });

    it("should return swapped dimensions for orientation 5", () => {
      expect(getActualDimensions(100, 50, 5)).toEqual({ width: 50, height: 100 });
    });

    it("should return swapped dimensions for orientation 7", () => {
      expect(getActualDimensions(100, 50, 7)).toEqual({ width: 50, height: 100 });
    });

    it("should return swapped dimensions for orientation 8", () => {
      expect(getActualDimensions(100, 50, 8)).toEqual({ width: 50, height: 100 });
    });

    it("should return original dimensions for orientation 2", () => {
      expect(getActualDimensions(100, 50, 2)).toEqual({ width: 100, height: 50 });
    });

    it("should return original dimensions for orientation 3", () => {
      expect(getActualDimensions(100, 50, 3)).toEqual({ width: 100, height: 50 });
    });

    it("should return original dimensions for orientation 4", () => {
      expect(getActualDimensions(100, 50, 4)).toEqual({ width: 100, height: 50 });
    });
  });

  describe("calculateTotalDimensions", () => {
    it("should calculate total dimensions with both borders", () => {
      const result = calculateTotalDimensions(100, 50, 20, 10, true, 1);
      expect(result).toEqual({ width: 160, height: 110 });
    });

    it("should calculate total dimensions without inner border", () => {
      const result = calculateTotalDimensions(100, 50, 20, 10, false, 1);
      expect(result).toEqual({ width: 140, height: 90 });
    });

    it("should calculate total dimensions with rotated orientation", () => {
      const result = calculateTotalDimensions(100, 50, 20, 10, true, 6);
      expect(result).toEqual({ width: 110, height: 160 });
    });

    it("should handle zero outer border", () => {
      const result = calculateTotalDimensions(100, 50, 0, 10, true, 1);
      expect(result).toEqual({ width: 120, height: 70 });
    });

    it("should handle zero inner border", () => {
      const result = calculateTotalDimensions(100, 50, 20, 0, true, 1);
      expect(result).toEqual({ width: 140, height: 90 });
    });

    it("should handle both zero borders", () => {
      const result = calculateTotalDimensions(100, 50, 0, 0, true, 1);
      expect(result).toEqual({ width: 100, height: 50 });
    });
  });
});