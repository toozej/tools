export type LayoutId =
  | "single"
  | "diptych-row"
  | "diptych-column"
  | "triptych-row"
  | "triptych-column"
  | "feature-triptych";

export interface LayoutCell {
  column: number;
  row: number;
  columnSpan?: number;
  rowSpan?: number;
}

export interface LayoutDefinition {
  id: LayoutId;
  name: string;
  description: string;
  columns: number;
  rows: number;
  cells: LayoutCell[];
}

export const LAYOUTS: LayoutDefinition[] = [
  { id: "single", name: "Single image", description: "One image with a mat.", columns: 1, rows: 1, cells: [{ column: 0, row: 0 }] },
  { id: "diptych-row", name: "Side-by-side diptych", description: "Two images in one row.", columns: 2, rows: 1, cells: [{ column: 0, row: 0 }, { column: 1, row: 0 }] },
  { id: "diptych-column", name: "Stacked diptych", description: "Two images in one column.", columns: 1, rows: 2, cells: [{ column: 0, row: 0 }, { column: 0, row: 1 }] },
  { id: "triptych-row", name: "Three-panel row", description: "Three images in one row.", columns: 3, rows: 1, cells: [{ column: 0, row: 0 }, { column: 1, row: 0 }, { column: 2, row: 0 }] },
  { id: "triptych-column", name: "Three-panel column", description: "Three images in one column.", columns: 1, rows: 3, cells: [{ column: 0, row: 0 }, { column: 0, row: 1 }, { column: 0, row: 2 }] },
  { id: "feature-triptych", name: "Feature triptych", description: "One tall image beside two stacked images.", columns: 2, rows: 2, cells: [{ column: 0, row: 0, rowSpan: 2 }, { column: 1, row: 0 }, { column: 1, row: 1 }] },
];

export function getLayout(id: LayoutId): LayoutDefinition {
  return LAYOUTS.find((layout) => layout.id === id) ?? LAYOUTS[0];
}

export function getLayoutDimensions(
  layout: LayoutDefinition,
  cellWidth: number,
  cellHeight: number,
  outerWidth: number,
  innerWidth: number
): { width: number; height: number } {
  const contentWidth = layout.columns * cellWidth + (layout.columns - 1) * innerWidth;
  const contentHeight = layout.rows * cellHeight + (layout.rows - 1) * innerWidth;
  const frameWidth = outerWidth + innerWidth;

  return { width: contentWidth + frameWidth * 2, height: contentHeight + frameWidth * 2 };
}
