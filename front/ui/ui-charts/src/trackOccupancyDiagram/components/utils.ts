import { type TickPattern } from '../lib/types';

type DrawTextType = {
  ctx: CanvasRenderingContext2D;
  text: string;
  x: number;
  y: number;
  color: string;
  xPosition?: 'left' | 'center' | 'right';
  yPosition?: 'top' | 'middle' | 'bottom';
  font?: string;
  rotateAngle?: number;
  stroke?: {
    color: string;
    width: number;
  };
};

const ELLIPSIS = '…';

/**
 * Cuts a text so that it fits a width, ending it with an ellipsis. The context must already be
 * set to the font the text is drawn with.
 */
export const truncateTextToWidth = (
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
) => {
  if (ctx.measureText(text).width <= maxWidth) return text;

  const characters = Array.from(text);
  let fitting = 0;
  let tooLong = characters.length;
  while (tooLong - fitting > 1) {
    const middle = Math.floor((fitting + tooLong) / 2);
    const cut = characters.slice(0, middle).join('');
    if (ctx.measureText(`${cut}${ELLIPSIS}`).width <= maxWidth) fitting = middle;
    else tooLong = middle;
  }
  return `${characters.slice(0, fitting).join('')}${ELLIPSIS}`;
};

export const drawText = ({
  ctx,
  text,
  x,
  y,
  color,
  xPosition = 'left',
  yPosition = 'bottom',
  font = '400 12px IBM Plex Sans',
  rotateAngle = 0,
  stroke,
}: DrawTextType) => {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotateAngle);

  ctx.font = font;
  ctx.textAlign = xPosition;
  ctx.textBaseline = yPosition;
  ctx.fillStyle = color;
  if (stroke) {
    ctx.lineWidth = stroke.width;
    ctx.strokeStyle = stroke.color;
    ctx.strokeText(text, 0, 0);
  }
  ctx.fillText(text, 0, 0);

  ctx.restore();
};

export const getTickPattern = (minutes: string): TickPattern => {
  const tickPatternMap: Record<string, TickPattern> = {
    '00': 'HOUR',
    '30': 'HALF_HOUR',
    '15': 'QUARTER_HOUR',
    '45': 'QUARTER_HOUR',
    '05': 'FIVE_MINUTES',
    '10': 'FIVE_MINUTES',
    '20': 'FIVE_MINUTES',
    '25': 'FIVE_MINUTES',
    '35': 'FIVE_MINUTES',
    '40': 'FIVE_MINUTES',
    '50': 'FIVE_MINUTES',
    '55': 'FIVE_MINUTES',
  };
  return tickPatternMap[minutes] ?? 'MINUTE';
};

export const getLabelMarks = (
  timeRanges: number[],
  minT: number,
  maxT: number,
  labelLevels: number[]
) => {
  const labelMarks: Record<number, { level: number; rangeIndex: number }> = {};

  if (!Number.isFinite(minT) || !Number.isFinite(maxT)) return labelMarks;

  timeRanges.map((range, index) => {
    const labelLevel = labelLevels[index];

    if (!labelLevel) return;

    for (let t = Math.floor(minT / range) * range; t <= maxT; t += range) {
      labelMarks[t] = { level: labelLevel, rangeIndex: index };
    }
  });

  return labelMarks;
};

export const getLabelLevels = (
  breakpoints: number[],
  pixelsPerMinute: number,
  ticksPriorities: number[][]
): number[] => {
  const index = breakpoints.findIndex((breakpoint) => pixelsPerMinute < breakpoint);
  return index >= 0 ? ticksPriorities[index] : [];
};
