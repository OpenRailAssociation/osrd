import { clamp } from 'lodash';

import type { Point, RGBColor, RGBAColor } from '../../common/types';
import type { SpaceTimeChartContextType } from '../lib/types';

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
        if (pointA.y > y !== pointB.y > y && x < (y - c) / m) {
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
