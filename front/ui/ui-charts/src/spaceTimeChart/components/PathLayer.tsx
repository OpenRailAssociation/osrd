import { useCallback } from 'react';

import { flatten, inRange } from 'lodash';

import { hexToRgb, indexToColor } from '../../common/helpers/colors';
import { useDraw, usePicking } from '../../common/hooks/useCanvas';
import type {
  CurveStyle,
  DataPoint,
  DrawingFunction,
  PathLevel,
  PickingDrawingFunction,
  PickingElement,
  Point,
} from '../../common/types';
import { SpaceTimeChartCanvasContext } from '../lib/context';
import { type OperationalPoint, type PathData, type SpaceTimeChartContextType } from '../lib/types';
import { drawAliasedDisc, drawAliasedLine } from '../utils/canvas';
import { getPathDirection, getSpacePixels } from '../utils/paths';
import { getSpaceBreakpoints } from '../utils/scales';

const DEFAULT_PICKING_TOLERANCE = 5;
const PAUSE_THICKNESS = 7;
const PAUSE_OPACITY = 0.2;
const CIRCLE_RADIUS = 4;
const VERTICAL_LINE_HEIGHT = 18;
const TEXT_PADDING = 3;

export type PointPickingElement = PickingElement & { type: 'point'; pathId: string; point: Point };

export type SegmentPickingElement = PickingElement & {
  type: 'segment';
  pathId: string;
  from: Point;
  to: Point;
};

export function isPointPickingElement(element: PickingElement): element is PointPickingElement {
  return element.type === 'point';
}

export function isSegmentPickingElement(element: PickingElement): element is SegmentPickingElement {
  return element.type === 'segment';
}

type PathStyle = {
  width: number;
  endWidth: number;
  dashArray?: number[];
  lineCap: CanvasLineCap;
};

const STYLES: Record<PathLevel, PathStyle> = {
  1: {
    width: 0.5,
    endWidth: 0.5,
    lineCap: 'round',
  },
  2: {
    width: 1,
    endWidth: 1,
    lineCap: 'round',
  },
  3: {
    width: 1.5,
    endWidth: 1.5,
    lineCap: 'round',
  },
  4: {
    width: 1,
    endWidth: 1,
    dashArray: [5, 5],
    lineCap: 'square',
  },
  5: {
    width: 1.5,
    endWidth: 1,
    dashArray: [0, 4],
    lineCap: 'round',
  },
} as const;
export const DEFAULT_LEVEL: PathLevel = 2;

export type PathLayerProps = {
  path: PathData;
  // Style:
  color: string;
  pickingTolerance?: number;
  level?: PathLevel;
  opacity?: number;
  border?: CurveStyle['outline'];
  label?: CurveStyle['label'];
};

/**
 * This component handles drawing a Path inside a SpaceTimeChart. It renders:
 * - The path itself
 * - The pauses
 * - The "picking" shape (to handle interactions)
 */
export const PathLayer = ({
  path,
  color,
  level = DEFAULT_LEVEL,
  pickingTolerance = DEFAULT_PICKING_TOLERANCE,
  opacity = 1,
  border,
  label,
}: PathLayerProps) => {
  /**
   * This function returns the list of points to join to draw the path. As it can be discontinuous,
   * it is returned as a Point[][]. For now, the only case for discontinuous paths is when the path
   * stops on or crosses a flat step (in which case, we assume the path will be drawn differently
   * in the flat step layer).
   *
   * It will be both used to render the visible path, and the segments on the picking layer.
   */
  const getPathLines = useCallback(
    ({
      getTimePixel,
      getSpacePixel,
      spaceScaleTree,
      flatSteps,
      timeAxis,
      spaceAxis,
      width,
      height,
    }: SpaceTimeChartContextType): Point[][] => {
      const lines: Point[][] = [];
      let currentLine: Point[] = [];
      const { points } = path;

      for (let i = 0; i < points.length; i++) {
        const { position, time } = points[i];

        if (i === 0) {
          currentLine.push({
            [timeAxis]: getTimePixel(time),
            [spaceAxis]: getSpacePixel(position),
          } as Point);
        } else {
          const { position: prevPosition, time: prevTime } = points[i - 1];
          const spaceBreakPoints = getSpaceBreakpoints(prevPosition, position, spaceScaleTree);
          let previousBreakPosition = -Infinity;

          spaceBreakPoints.forEach((breakPosition, index) => {
            const nextBreakPosition = spaceBreakPoints[index + 1] ?? Infinity;
            const isBeforeFlatStep = previousBreakPosition === breakPosition;
            const isAfterFlatStep = breakPosition === nextBreakPosition;

            const readSpacePixelFromEnd = isBeforeFlatStep
              ? getPathDirection(path, i, true) === 'forward'
              : isAfterFlatStep
                ? getPathDirection(path, i - 1) === 'backward'
                : false;

            const breakTime =
              prevTime +
              ((breakPosition - prevPosition) / (position - prevPosition)) * (time - prevTime);

            const breakPoint = {
              [timeAxis]: getTimePixel(breakTime),
              [spaceAxis]: getSpacePixel(breakPosition, readSpacePixelFromEnd),
            } as Point;

            if (isBeforeFlatStep) {
              lines.push(currentLine);
              currentLine = [breakPoint];
            } else {
              currentLine.push(breakPoint);
            }

            previousBreakPosition = breakPosition;
          });

          const newPoint = {
            [timeAxis]: getTimePixel(time),
            [spaceAxis]: getSpacePixel(position),
          } as Point;

          if (position === prevPosition && flatSteps.has(position)) {
            lines.push(currentLine);
            currentLine = [newPoint];
          } else if (time === prevTime) {
            lines.push(currentLine);
            currentLine = [newPoint];
          } else {
            currentLine.push(newPoint);
          }
        }
      }

      lines.push(currentLine);

      // Only keep segments that intersect with the current visible time frame:
      const visibleLines: Point[][] = [];

      const minPixel = 0;
      const maxPixel = timeAxis === 'x' ? width : height;
      lines.forEach((line) => {
        const lastPointBeforeMinIndex = line.findLastIndex((p) => p[timeAxis] < minPixel);
        const firstPointAfterMaxIndex = line.findIndex((p) => p[timeAxis] > maxPixel);
        const visibleLine = line.slice(
          lastPointBeforeMinIndex === -1 ? 0 : lastPointBeforeMinIndex,
          (firstPointAfterMaxIndex === -1 ? line.length : firstPointAfterMaxIndex) + 1
        );
        if (visibleLine.length) visibleLines.push(visibleLine);
      });

      return visibleLines;
    },
    [path]
  );
  /**
   * This function returns the list of important points, where the mouse can snap.
   */
  const getSnapPoints = useCallback(
    ({
      getTimePixel,
      getSpacePixel,
      timeAxis,
      spaceAxis,
      operationalPoints,
      width,
      height,
    }: SpaceTimeChartContextType): Point[] => {
      const res: Point[] = [];
      const stopPositions = new Set(operationalPoints.map((p) => p.position));
      path.points.forEach(({ position, time }) => {
        if (stopPositions.has(position))
          res.push({
            [timeAxis]: getTimePixel(time),
            [spaceAxis]: getSpacePixel(position),
          } as Point);
      });

      // Only keep visible points:
      const radius = STYLES[level].width + pickingTolerance;
      return res.filter(
        (p) => inRange(p.x, -radius, width + radius) && inRange(p.y, -radius, height + radius)
      );
    },
    [level, path.points, pickingTolerance]
  );

  /**
   * This function draws the stops of the path on the operational points.
   */
  const drawPauses = useCallback<DrawingFunction<SpaceTimeChartContextType>>(
    (ctx, { getTimePixel, getSpacePixel, operationalPoints, swapAxis }) => {
      const stopPositions = new Set(operationalPoints.map((p) => p.position));
      path.points.forEach(({ position, time }, i, a) => {
        if (i) {
          const { position: prevPosition, time: prevTime } = a[i - 1];
          if (prevPosition === position && stopPositions.has(position)) {
            // Only draw the stop when there is no flat step
            // (i.e. when there's only one space pixel):
            const rawPixels = getSpacePixels(getSpacePixel, position);
            if (rawPixels.length === 1) {
              // Use the raw coordinate so the pause sits exactly on the
              // curve. Adjusting it for sharper rendering would move the
              // pause, and one side would look thicker than the other.
              const spacePixel = rawPixels[0];
              ctx.beginPath();
              if (!swapAxis) {
                ctx.moveTo(getTimePixel(prevTime), spacePixel);
                ctx.lineTo(getTimePixel(time), spacePixel);
              } else {
                ctx.moveTo(spacePixel, getTimePixel(prevTime));
                ctx.lineTo(spacePixel, getTimePixel(time));
              }
              ctx.stroke();
            }
          }
        }
      });
    },
    [path]
  );

  /**
   * This function draws the label with a background.
   * It is used to draw the label of the path or single point, with a background to make it more readable.
   */
  const drawLabelWithBackground = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      text: string,
      x: number,
      y: number,
      {
        textColor,
        background,
        fontSize,
        fontFamily,
        fontWeight = 400,
        padding = TEXT_PADDING,
        alpha = 0.75,
        borderColor,
      }: {
        textColor: string;
        background: string;
        fontSize?: number;
        fontFamily?: string;
        fontWeight?: number;
        padding?: number;
        alpha?: number;
        borderColor?: string;
      }
    ) => {
      ctx.save();

      ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;

      const measure = ctx.measureText(text);
      const left = measure.actualBoundingBoxLeft;
      const right = measure.actualBoundingBoxRight;
      const ascent = measure.actualBoundingBoxAscent;
      const descent = measure.actualBoundingBoxDescent;

      const w = left + right + 2 * padding;
      const h = ascent + descent + 2 * padding;

      const rx = x - left - padding;
      const ry = y - ascent - padding;

      // BACKGROUND
      ctx.globalAlpha = alpha * opacity;
      ctx.fillStyle = background;
      ctx.beginPath();
      ctx.roundRect(rx, ry, w, h, 3);
      ctx.fill();

      // BORDER
      if (borderColor) {
        ctx.save();
        ctx.globalAlpha = opacity;
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = 1;
        ctx.roundRect(rx, ry, w, h, 3);
        ctx.stroke();
        ctx.restore();
      }

      // TEXT
      ctx.globalAlpha = opacity;
      ctx.fillStyle = textColor;
      ctx.fillText(text, x, y);

      ctx.restore();
    },
    [opacity]
  );

  /**
   * This function draws the label of the path.
   */
  const drawLabel = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      {
        width,
        height,
        swapAxis,
        captionSize,
        theme: {
          background,
          pathsStyles: { fontSize, fontFamily },
        },
      }: SpaceTimeChartContextType,
      text: string,
      labelColor: string,
      points: Point[],
      pathLength: number
    ) => {
      if (!text) return;

      const firstPointOnScreenIndex = points.findIndex(({ x, y }) =>
        !swapAxis
          ? inRange(x, 0, width) && inRange(y, 0, height - captionSize)
          : inRange(x, captionSize, width) && inRange(y, 0, height)
      );

      if (firstPointOnScreenIndex < 0) return;

      const prev = points[firstPointOnScreenIndex - 1];
      const curr = points[firstPointOnScreenIndex];
      const next = points[firstPointOnScreenIndex + 1];

      let position: Point = curr;
      let angle = 0;

      if (firstPointOnScreenIndex === 0) {
        if (next) angle = Math.atan2(next.y - curr.y, next.x - curr.x);
      } else {
        const minX = swapAxis ? captionSize : 0;
        const slope = (curr.y - prev.y) / (curr.x - prev.x);
        const yOnYAxisIntersect = curr.y - (curr.x - minX) * slope;
        const xOnXAxisIntersect = curr.x - minX - curr.y / slope;
        if (yOnYAxisIntersect >= 0) {
          position = {
            x: minX,
            y: yOnYAxisIntersect,
          };
        } else {
          position = {
            x: xOnXAxisIntersect + 10 / slope,
            y: 10,
          };
        }

        angle = Math.atan2(curr.y - prev.y, curr.x - prev.x);
      }

      // Finally, draw label:
      ctx.save();
      ctx.translate(position.x, position.y);
      ctx.rotate(angle);
      ctx.textAlign = 'start';

      const padding = 2;
      const measure = ctx.measureText(text);
      const w = measure.width + 2 * padding;

      const dx = w < pathLength ? 5 : (pathLength - w) / 2; // Progressively center the label if the path is shorter than the label
      const dy = angle >= 0 ? -7 : 17;

      drawLabelWithBackground(ctx, text, dx, dy, {
        fontSize,
        fontFamily,
        fontWeight: label?.fontWeight,
        textColor: label?.color ?? labelColor,
        background: label?.background?.color ?? background,
        alpha: label?.background?.opacity,
        borderColor: label?.background?.border,
        padding,
      });
      ctx.restore();
    },
    [drawLabelWithBackground, label]
  );

  const computePathLength = useCallback(
    (operationalPoints: OperationalPoint[], lines: Point[][]) => {
      let totalLength = 0;

      // Compute length of pauses
      const stopPositions = new Set(operationalPoints.map((p) => p.position));
      path.points.forEach(({ position, time }, i, pointsArray) => {
        if (i > 0) {
          const { position: prevPosition, time: prevTime } = pointsArray[i - 1];
          if (prevPosition === position && stopPositions.has(position)) {
            totalLength += time - prevTime;
          }
        }
      });

      // Compute length of pathSegments
      lines.forEach((line) => {
        line.forEach(({ x, y }, i, a) => {
          if (i > 0) {
            const { x: prevX, y: prevY } = a[i - 1];
            totalLength += Math.sqrt(Math.pow(prevX - x, 2) + Math.pow(prevY - y, 2));
          }
        });
      });

      return totalLength;
    },
    [path]
  );

  const drawBorder = useCallback<DrawingFunction<SpaceTimeChartContextType>>(
    (ctx, stcContext) => {
      if (!border) return;
      const borderWidth = border.width || 1;
      const mainPathStyle = STYLES[level];
      const totalPathWidth = border.offset * 2 + mainPathStyle.width;
      const backgroundColor = border.backgroundColor || '#fff';
      const lines = getPathLines(stcContext);
      ctx.save();
      ctx.globalAlpha = opacity;
      const drawLines = (lineWidth: number, borderColor = border.color) => {
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = lineWidth;
        ctx.lineCap = 'round';
        lines.forEach((segments) => {
          ctx.beginPath();
          segments.forEach(({ x, y }, i) => {
            if (x === segments[i - 1]?.x && y === segments[i - 1]?.y) return;
            if (i === 0) {
              ctx.moveTo(x, y);
            } else {
              ctx.lineTo(x, y);
            }
          });
          ctx.stroke();
        });
      };

      drawLines(totalPathWidth + borderWidth * 2);
      drawLines(totalPathWidth, backgroundColor);

      ctx.restore();
    },
    [border, getPathLines, level, opacity]
  );

  const drawSinglePoint = useCallback(
    (ctx: CanvasRenderingContext2D, stcContext: SpaceTimeChartContextType, point: DataPoint) => {
      const {
        getPoint,
        hidePathsLabels,
        theme: {
          background,
          pathsStyles: { fontSize, fontFamily },
        },
      } = stcContext;
      const { x, y } = getPoint(point);
      const style = STYLES[level];

      ctx.save();

      ctx.strokeStyle = color;
      ctx.lineWidth = style.width;
      ctx.setLineDash((style.dashArray || []).map((v) => v / 2));

      // Draw the vertical lines above and below the circle
      ctx.beginPath();
      ctx.moveTo(x, y - VERTICAL_LINE_HEIGHT / 2);
      ctx.lineTo(x, y + VERTICAL_LINE_HEIGHT / 2);
      ctx.stroke();

      // Draw the circle
      ctx.beginPath();
      ctx.arc(x, y, CIRCLE_RADIUS, 0, Math.PI * 2);
      ctx.stroke();

      // Draw the label
      if (!hidePathsLabels) {
        ctx.textAlign = 'center';
        const labelY = y - CIRCLE_RADIUS - VERTICAL_LINE_HEIGHT - TEXT_PADDING;
        drawLabelWithBackground(ctx, path.label, x, labelY, {
          fontFamily,
          fontSize,
          fontWeight: label?.fontWeight,
          textColor: label?.color ?? color,
          background: label?.background?.color ?? background,
          alpha: label?.background?.opacity,
          borderColor: label?.background?.border,
        });
      }

      ctx.restore();
    },
    [level, color, drawLabelWithBackground, path.label, label]
  );

  const drawAll = useCallback<DrawingFunction<SpaceTimeChartContextType>>(
    (ctx, stcContext) => {
      if (path.points.length === 1) {
        drawSinglePoint(ctx, stcContext, path.points[0]);
        return;
      }

      drawBorder(ctx, stcContext);

      // Draw stops:
      ctx.strokeStyle = color;
      ctx.lineWidth = PAUSE_THICKNESS;
      ctx.globalAlpha = PAUSE_OPACITY * opacity;
      ctx.lineCap = 'round';
      drawPauses(ctx, stcContext);

      const style = STYLES[level];

      // Draw main path:
      ctx.strokeStyle = color;
      ctx.lineWidth = style.width;
      ctx.setLineDash(style.dashArray || []);
      ctx.globalAlpha = opacity;
      ctx.lineCap = style.lineCap;
      const lines = getPathLines(stcContext);
      lines.forEach((points) => {
        ctx.beginPath();
        points.forEach(({ x, y }, i) => {
          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        });
        ctx.stroke();
      });

      // Draw label:
      if (!stcContext.hidePathsLabels) {
        const pathLength = computePathLength(stcContext.operationalPoints, lines);
        // TODO:
        // We should improve how the labels are drawn, and handle discontinuous lines (instead of
        // flattening the points)
        drawLabel(ctx, stcContext, path.label, color, flatten(lines), pathLength);
      }
    },
    [
      path.points,
      path.label,
      drawBorder,
      color,
      drawPauses,
      level,
      opacity,
      getPathLines,
      drawSinglePoint,
      computePathLength,
      drawLabel,
    ]
  );
  useDraw(SpaceTimeChartCanvasContext, 'paths', drawAll);

  const drawPicking = useCallback<PickingDrawingFunction<SpaceTimeChartContextType>>(
    (imageData, stcContext, scalingRatio) => {
      const { registerPickingElement } = stcContext;

      // Draw single point:
      if (path.points.length === 1) {
        const pickingElement: PointPickingElement = {
          type: 'point',
          pathId: path.id,
          point: stcContext.getPoint(path.points[0]),
        };
        const index = registerPickingElement(pickingElement);
        const pointColor = hexToRgb(indexToColor(index));

        drawAliasedDisc(
          imageData,
          pickingElement.point,
          VERTICAL_LINE_HEIGHT / 2,
          pointColor,
          false,
          scalingRatio
        );
      }

      // Draw segments:
      getPathLines(stcContext).forEach((line) =>
        line.forEach((point, i, a) => {
          if (i) {
            const previousPoint = a[i - 1];
            const pickingElement: SegmentPickingElement = {
              type: 'segment',
              pathId: path.id,
              from: previousPoint,
              to: point,
            };
            const index = registerPickingElement(pickingElement);
            const lineColor = hexToRgb(indexToColor(index));

            // Skip segments linking two points on the same time value (these are flat steps, and paths shouldn't be
            // actionable on these steps):
            if (previousPoint[stcContext.timeAxis] === point[stcContext.timeAxis]) return;

            drawAliasedLine(
              imageData,
              previousPoint,
              point,
              lineColor,
              STYLES[level].width + pickingTolerance,
              true,
              scalingRatio
            );
          }
        })
      );

      // Draw snap points:
      getSnapPoints(stcContext).forEach((point) => {
        const pickingElement: PointPickingElement = {
          type: 'point',
          pathId: path.id,
          point,
        };
        const index = registerPickingElement(pickingElement);
        const lineColor = hexToRgb(indexToColor(index));
        drawAliasedDisc(
          imageData,
          point,
          (STYLES[level].width + pickingTolerance) * 2,
          lineColor,
          false,
          scalingRatio
        );
      });
    },
    [getPathLines, getSnapPoints, level, path.id, path.points, pickingTolerance]
  );

  usePicking(SpaceTimeChartCanvasContext, 'paths', drawPicking);

  return null;
};

export default PathLayer;
