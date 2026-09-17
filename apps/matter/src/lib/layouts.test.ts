import { describe, expect, it } from "bun:test";
import { getLayout, getLayoutDimensions } from "./layouts";

describe("layout utilities", () => {
  it("returns the side-by-side diptych", () => {
    const layout = getLayout("diptych-row");
    expect(layout.columns).toBe(2);
    expect(layout.rows).toBe(1);
    expect(layout.cells).toHaveLength(2);
  });

  it("uses the inner width for the frame and panel gap", () => {
    expect(getLayoutDimensions(getLayout("diptych-row"), 100, 50, 20, 10)).toEqual({ width: 270, height: 110 });
  });

  it("uses one cell that spans two rows for the feature triptych", () => {
    expect(getLayout("feature-triptych").cells[0]).toEqual({ column: 0, row: 0, rowSpan: 2 });
  });
});
