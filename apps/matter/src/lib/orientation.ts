export function applyOrientation(
  ctx: CanvasRenderingContext2D,
  orientation: number,
  width: number,
  height: number
): void {
  switch (orientation) {
    case 2:
      ctx.transform(-1, 0, 0, 1, width, 0);
      break;
    case 3:
      ctx.transform(-1, 0, 0, -1, width, height);
      break;
    case 4:
      ctx.transform(1, 0, 0, -1, 0, height);
      break;
    case 5:
      ctx.transform(0, 1, 1, 0, 0, 0);
      break;
    case 6:
      ctx.transform(0, 1, -1, 0, height, 0);
      break;
    case 7:
      ctx.transform(0, -1, -1, 0, height, width);
      break;
    case 8:
      ctx.transform(0, -1, 1, 0, 0, width);
      break;
  }
}

export function isRotatedOrientation(orientation: number): boolean {
  return [5, 6, 7, 8].includes(orientation);
}

export function getActualDimensions(
  width: number,
  height: number,
  orientation: number
): { width: number; height: number } {
  const rotated = isRotatedOrientation(orientation);
  return rotated
    ? { width: height, height: width }
    : { width, height };
}

export function calculateTotalDimensions(
  imageWidth: number,
  imageHeight: number,
  outerWidth: number,
  innerWidth: number,
  showInner: boolean,
  orientation: number
): { width: number; height: number } {
  const { width: actualWidth, height: actualHeight } = getActualDimensions(
    imageWidth,
    imageHeight,
    orientation
  );
  const inner = showInner ? innerWidth : 0;
  return {
    width: actualWidth + outerWidth * 2 + inner * 2,
    height: actualHeight + outerWidth * 2 + inner * 2,
  };
}