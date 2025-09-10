import { clamp } from 'lodash';

import type {
  SpaceTimeChartContextType,
  Direction,
  PathEnd,
  Point,
  RGBAColor,
  RGBColor,
} from '../lib/types';

/**
 * This function returns the picking layers scaling ratio. We basically take the min of the screen
 * pixels and the "HTML pixels", and divide it by two.
 *
 * This allows having a smaller picking stage to fill (so it's faster), while keeping a "good enough
 * precision".
 */
export function getPickingScalingRatio(): number {
  const PICKING_DOWNSCALING_RATIO = 0.5;
  const dpr = window.devicePixelRatio || 1;

  // When devicePixelRatio is over 1 (like for Retina displays), we downscale based on the "HTML
  // pixels":
  if (dpr > 1) return PICKING_DOWNSCALING_RATIO;

  // When devicePixelRatio is under or equal to 1 (like when the user zooms out for instance), we
  // downscale based on the actual "screen pixels" (to avoid having a too large scene to fill):
  return PICKING_DOWNSCALING_RATIO * dpr;
}

/**
 * This function draws a thick lines from "from" to "to" on the given ImageData, with no
 * antialiasing. This is very useful to handle picking, since it is not possible to disable
 * antialiasing with the native JavaScript canvas APIs.
 */
export function drawAliasedLine(
  imageData: ImageData,
  { x: fromX, y: fromY }: Point,
  { x: toX, y: toY }: Point,
  [r, g, b]: RGBColor | RGBAColor,
  thickness: number,
  drawOnBottom: boolean,
  scalingRatio = 1
): void {
  if (fromX > toX)
    return drawAliasedLine(
      imageData,
      { x: toX, y: toY },
      { x: fromX, y: fromY },
      [r, g, b],
      thickness,
      drawOnBottom,
      scalingRatio
    );

  fromX = Math.round(fromX * scalingRatio);
  fromY = Math.round(fromY * scalingRatio);
  toX = Math.round(toX * scalingRatio);
  toY = Math.round(toY * scalingRatio);
  thickness = Math.round(thickness * scalingRatio);

  const width = imageData.width;
  const height = imageData.height;
  const dx = toX - fromX;
  const dy = toY - fromY;
  const len = Math.sqrt(dx * dx + dy * dy);

  // Calculate perpendicular vector
  const normX = -dy / len;
  const normY = dx / len;

  // Calculate the four corners of the rectangle
  const halfThickness = Math.ceil(thickness / 2);

  const corner1 = {
    x: fromX + (+normX - dx / len) * halfThickness,
    y: fromY + (+normY - dy / len) * halfThickness,
  };
  const corner2 = {
    x: fromX + (-normX - dx / len) * halfThickness,
    y: fromY + (-normY - dy / len) * halfThickness,
  };
  const corner3 = {
    x: toX + (-normX + dx / len) * halfThickness,
    y: toY + (-normY + dy / len) * halfThickness,
  };
  const corner4 = {
    x: toX + (+normX + dx / len) * halfThickness,
    y: toY + (+normY + dy / len) * halfThickness,
  };

  const ascending = fromY < toY;
  const top = ascending ? corner4 : corner1;
  const left = ascending ? corner1 : corner2;
  const right = ascending ? corner3 : corner4;
  const bottom = ascending ? corner2 : corner3;

  const xMin = clamp(Math.floor(left.x), 0, width);
  const xMax = clamp(Math.ceil(right.x), 0, width);
  const yMin = clamp(Math.floor(bottom.y), 0, height);
  const yMax = clamp(Math.ceil(top.y), 0, height);

  for (let y = yMin; y <= yMax; y++) {
    const xMinRow = clamp(
      y < left.y
        ? Math.floor(bottom.x + ((y - bottom.y) * (left.x - bottom.x)) / (left.y - bottom.y))
        : Math.floor(left.x + ((y - left.y) * (left.x - top.x)) / (left.y - top.y)),
      xMin,
      xMax
    );
    const xMaxRow = clamp(
      y < right.y
        ? Math.ceil(bottom.x + ((y - bottom.y) * (right.x - bottom.x)) / (right.y - bottom.y))
        : Math.ceil(right.x + ((y - right.y) * (right.x - top.x)) / (right.y - top.y)),
      xMin,
      xMax
    );

    for (let x = xMinRow; x <= xMaxRow; x++) {
      const index = (y * width + x) * 4;
      if (!drawOnBottom || !imageData.data[index + 3]) {
        imageData.data[index] = r;
        imageData.data[index + 1] = g;
        imageData.data[index + 2] = b;
        imageData.data[index + 3] = 255;
      }
    }
  }
}

/**
 * This function takes an integer radius, and returns a flat matrix of 1s and 0s, where the 1s
 * represent the pixels that are within the disc. The shapes are cached, to make it faster to draw
 * a lot of times discs of the same radius.
 *
 * Here are some examples to make it clearer what the output should look like:
 *
 * getAliasedDiscShape(0);
 * [1]
 * getAliasedDiscShape(1);
 * [0, 1, 0,
 *  1, 1, 1,
 *  0, 1, 0]
 * getAliasedDiscShape(2);
 * [0, 0, 1, 0, 0,
 *  0, 1, 1, 1, 0,
 *  1, 1, 1, 1, 1,
 *  0, 1, 1, 1, 0,
 *  0, 0, 1, 0, 0]
 */
const DISCS_CACHE: Map<number, Uint8Array> = new Map();
export function getAliasedDiscShape(radius: number): Uint8Array {
  const cachedShape = DISCS_CACHE.get(radius);
  if (cachedShape) return cachedShape;

  const diameter = radius * 2 + 1;
  const shape = new Uint8Array(diameter * diameter);

  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const distance = dx * dx + dy * dy;
      if (distance <= radius * radius) {
        const x = dx + radius;
        const y = dy + radius;
        shape[y * diameter + x] = 1;
      }
    }
  }

  DISCS_CACHE.set(radius, shape);
  return shape;
}

/**
 * This function draws an aliased disc, using a shape computed by getDiscShape.
 */
export function drawAliasedDisc(
  imageData: ImageData,
  { x: centerX, y: centerY }: Point,
  radius: number,
  [r, g, b]: RGBColor | RGBAColor,
  drawOnBottom: boolean,
  scalingRatio: number = 1
): void {
  centerX = Math.round(centerX * scalingRatio);
  centerY = Math.round(centerY * scalingRatio);
  radius = Math.ceil(radius * scalingRatio);

  const { width, height } = imageData;

  const discShape = getAliasedDiscShape(radius);

  // Draw the disc on the imageData
  const diameter = radius * 2 + 1;
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const shapeIndex = (dy + radius) * diameter + (dx + radius);
      if (discShape[shapeIndex] === 1) {
        const x = centerX + dx;
        const y = centerY + dy;
        if (x >= 0 && x < width && y >= 0 && y < height) {
          const index = (y * width + x) * 4;
          if (!drawOnBottom || !imageData.data[index + 3]) {
            imageData.data[index] = r;
            imageData.data[index + 1] = g;
            imageData.data[index + 2] = b;
            imageData.data[index + 3] = 255;
          }
        }
      }
    }
  }
}

/**
 * Draws an aliased quadrilateral
 *
 *      vertices[0]   ________ vertices[1]
 *                  /        /
 *     vertices[3] /________/ vertices[2]
 *
 */
export function drawAliasedQuadrilateral(
  imageData: ImageData,
  points: [Point, Point, Point, Point],
  [r, g, b]: RGBColor | RGBAColor,
  scalingRatio: number = 1
): void {
  const vertices = points.map((point) => ({
    x: Math.round(point.x * scalingRatio),
    y: Math.round(point.y * scalingRatio),
  }));

  let { x: xmin, x: xmax, y: ymin, y: ymax } = vertices[0];
  for (let i = 1; i < vertices.length; i++) {
    const { x, y } = vertices[i];
    if (x < xmin) xmin = x;
    else if (x > xmax) xmax = x;

    if (y < ymin) ymin = y;
    else if (y > ymax) ymax = y;
  }

  xmin = clamp(xmin, 0, imageData.width - 1);
  ymin = clamp(ymin, 0, imageData.height - 1);
  xmax = clamp(xmax, 0, imageData.width - 1);
  ymax = clamp(ymax, 0, imageData.height - 1);

  for (let y = ymin; y < ymax; y++) {
    for (let x = xmin; x < xmax; x++) {
      // Compute whether the point is inside the quadrilateral
      // using the Ray casting algorithm (see https://en.wikipedia.org/wiki/Point_in_polygon)
      let isInside = false;
      for (let i = 0; i < vertices.length; i++) {
        const pointA = vertices[i];
        const pointB = i === vertices.length - 1 ? vertices[0] : vertices[i + 1];

        // Line equation from A to B: y(x) = m * x + c
        const m = (pointB.y - pointA.y) / (pointB.x - pointA.x);
        const c = pointB.y - m * pointB.x;

        // Invert the equation: x(y) = (y - c) / m
        // Look only for points that are on the left of the line, so for a given y, x < (y - c) / m
        if (pointA.y > y != pointB.y > y && x < (y - c) / m) {
          isInside = !isInside;
        }
      }

      // If the point is inside the quadrilateral, allow interactions with it
      if (isInside) {
        const index = (y * imageData.width + x) * 4;
        imageData.data[index] = r;
        imageData.data[index + 1] = g;
        imageData.data[index + 2] = b;
        imageData.data[index + 3] = 255;
      }
    }
  }
}

export function drawAliasedRect(
  imageData: ImageData,
  { x, y }: Point,
  width: number,
  height: number,
  [r, g, b]: RGBColor | RGBAColor,
  scalingRatio = 1
) {
  x = Math.round(x * scalingRatio);
  y = Math.round(y * scalingRatio);
  width = Math.round(width * scalingRatio);
  height = Math.round(height * scalingRatio);

  const xMin = clamp(x, 0, imageData.width);
  const yMin = clamp(y, 0, imageData.height);
  const xMax = clamp(x + width, 0, imageData.width);
  const yMax = clamp(y + height, 0, imageData.height);

  for (let i = xMin; i < xMax; i++) {
    for (let j = yMin; j < yMax; j++) {
      const index = (j * imageData.width + i) * 4;
      imageData.data[index] = r;
      imageData.data[index + 1] = g;
      imageData.data[index + 2] = b;
      imageData.data[index + 3] = 255;
    }
  }
}

/**
 * This function draws a "stop" path extremity.
 * That handles a path that stops or starts exactly in an operational points included in the line
 * represented in the chart.
 */
const STOP_END_SIZE = 6;
export function drawPathStopExtremity(
  ctx: CanvasRenderingContext2D,
  timePixel: number,
  spacePixel: number,
  swapAxis: boolean
): void {
  ctx.beginPath();
  if (!swapAxis) {
    ctx.moveTo(timePixel, spacePixel - STOP_END_SIZE / 2);
    ctx.lineTo(timePixel, spacePixel + STOP_END_SIZE / 2);
  } else {
    ctx.moveTo(spacePixel - STOP_END_SIZE / 2, timePixel);
    ctx.lineTo(spacePixel + STOP_END_SIZE / 2, timePixel);
  }
  ctx.stroke();
}

/**
 * This function draws an "out" path extremity.
 * That handles a path that leaves or joins the line represented in the chart.
 */
const OUT_END_SIZE = 12;
export function drawPathOutExtremity(
  ctx: CanvasRenderingContext2D,
  timePixel: number,
  spacePixel: number,
  swapAxis: boolean,
  extremityType: 'from' | 'to',
  pathDirection: Direction
): void {
  let horizontalSign = extremityType === 'from' ? -1 : 1;
  let verticalSign = (pathDirection === 'backward' ? -1 : 1) * horizontalSign;
  let controlX = timePixel + 4 * horizontalSign;
  let controlY = spacePixel + (OUT_END_SIZE - 2) * verticalSign;
  let x = timePixel;
  let y = spacePixel;
  if (swapAxis) {
    [horizontalSign, verticalSign] = [verticalSign, horizontalSign];
    [controlX, controlY] = [controlY, controlX];
    [x, y] = [y, x];
  }

  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.bezierCurveTo(
    controlX,
    controlY,
    controlX,
    controlY,
    x + OUT_END_SIZE * horizontalSign,
    y + OUT_END_SIZE * verticalSign
  );
  ctx.stroke();
}

/**
 * This function draws a path extremity.
 */
export function drawPathExtremity(
  ctx: CanvasRenderingContext2D,
  timePixel: number,
  spacePixel: number,
  swapAxis: boolean,
  extremityType: 'from' | 'to',
  pathDirection: Direction,
  pathEnd: PathEnd
): void {
  if (pathEnd === 'out') {
    drawPathOutExtremity(ctx, timePixel, spacePixel, swapAxis, extremityType, pathDirection);
  } else {
    drawPathStopExtremity(ctx, timePixel, spacePixel, swapAxis);
  }
}

/**
 * @param minT number timestamp
 * @param maxT number timestamp
 * @param timeRanges time frames (24h, 12h, 6h, …)
 * @param gridlinesLevels width of the lines for each time frame
 * @param formatter function to format de values inside the output object
 * Keys are times in ms
 * Values are the highest level on each time
 */
export function computeVisibleTimeMarkers<T extends object = { level: number }>(
  minT: number,
  maxT: number,
  timeRanges: number[],
  gridlinesLevels: number[],
  formatter: (level: number, i: number) => T = (level: number) => ({ level }) as T
): (T & { time: number })[] {
  const result: Record<number, T & { time: number }> = {};
  const minTLocalOffset = new Date(minT).getTimezoneOffset() * 60 * 1000;

  timeRanges.forEach((range, i) => {
    const gridlinesLevel = gridlinesLevels[i];

    if (!gridlinesLevel) return;

    let t = Math.floor((minT - minTLocalOffset) / range) * range + minTLocalOffset;
    while (t <= maxT) {
      if (t >= minT) {
        result[t] = { ...formatter(gridlinesLevel, i), time: t };
      }
      t += range;
    }
  });
  return Object.values(result);
}

/**
 * To get crisp horizontal or vertical lines on a canvas, we must draw them as thin as possible, in
 * terms of actual pixels on screen.
 * The best way for this is:
 * - To center lines 1, 3, 5... pixels wide in the middle of a pixel (0.5, 1.5, 2.5...)
 * - To center lines 2, 4, 6... pixels wide between two pixels (0, 1, 2, 3...)
 * Also, for HiDPi screens:
 * - To center lines of "integer thicknesses" between two screen pixels (0, 0.5, 1, 1.5, 2...)
 * - To center lines with `n + 0.5` thicknesses in the middle of a screen pixel (0.25, 0.75, 1.25, 1.75...)
 * @param rawCoordinate Any input coordinate to fix
 * @param lineWidth The width of the line to draw
 * @param devicePixelRatio
 */
export function getCrispLineCoordinate(
  rawCoordinate: number,
  lineWidth: number,
  devicePixelRatio = window.devicePixelRatio || 1
): number {
  const centerOffset = Math.ceil(lineWidth * devicePixelRatio) / devicePixelRatio / 2;
  return (
    Math.round((rawCoordinate - centerOffset) * devicePixelRatio) / devicePixelRatio + centerOffset
  );
}

export type CanvasRect = {
  timeStart: Date;
  timeEnd: Date;
  spaceStart: number; // mm
  spaceEnd: number; // mm
};

/**
 * You most likely need to wrap this function call with ctx.save ctx.restore
 * as it modifies ctx current transformation matrix
 */
export function fillRect(
  ctx: CanvasRenderingContext2D,
  { timeStart, timeEnd, spaceStart, spaceEnd }: CanvasRect,
  { getPoint }: SpaceTimeChartContextType
) {
  const startPoint = getPoint({ time: Number(timeStart), position: spaceStart });
  const endPoint = getPoint({ time: Number(timeEnd), position: spaceEnd });

  const width = endPoint.x - startPoint.x;
  const height = endPoint.y - startPoint.y;

  if (width !== 0 && height !== 0) {
    ctx.translate(startPoint.x, startPoint.y);
    ctx.fillRect(0, 0, width, height);
  }

  return { width, height };
}
