import { drawTrack } from './drawTrack';
import { TRACK_HEIGHT_CONTAINER, CANVAS_PADDING, COLORS, TICKS_PRIORITIES } from '../../consts';
import { type Track } from '../../types';
import { getLabelLevels, getLabelMarks } from '../../utils';

export function getTimeToPixel(
  timeOrigin: number,
  pixelOffset: number,
  timeScale: number
): (time: number) => number {
  return (time: number) => pixelOffset + (time - timeOrigin) / timeScale;
}

const { WHITE_100, HOUR_BACKGROUND } = COLORS;

const drawBackground = ({
  ctx,
  xStart,
  width,
  height,
  switchBackground,
}: {
  ctx: CanvasRenderingContext2D;
  xStart: number;
  width: number;
  height: number;
  switchBackground: boolean;
}) => {
  if (xStart >= 0) {
    ctx.clearRect(xStart, 0, width, height);
    ctx.fillStyle = switchBackground ? HOUR_BACKGROUND : WHITE_100;
    ctx.fillRect(xStart, 0, width, height);
  }
};

type DrawTracksProps = {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  tracks: Track[] | undefined;
  timeOrigin: number;
  timePixelOffset: number;
  getTimePixel: (time: number) => number;
  timeRanges: number[];
  breakpoints: number[];
  timeScale: number;
};

export const drawTracks = ({
  ctx,
  width,
  height,
  tracks,
  timeOrigin,
  timePixelOffset,
  getTimePixel,
  timeRanges,
  breakpoints,
  timeScale,
}: DrawTracksProps) => {
  ctx.clearRect(0, 0, width, height);
  ctx.save();

  const minT = timeOrigin - timeScale * timePixelOffset;
  const maxT = minT + timeScale * width;
  const pixelsPerMinute = (1 / timeScale) * 60_000;

  const labelLevels = getLabelLevels(breakpoints, pixelsPerMinute, TICKS_PRIORITIES);

  const labelMarks = getLabelMarks(timeRanges, minT, maxT, labelLevels);

  let switchBackground = false;

  for (const t in labelMarks) {
    const date = new Date(+t);
    const minutes = date.getMinutes().toString().padStart(2, '0');

    switch (minutes) {
      case '00':
        switchBackground = !switchBackground;
        drawBackground({ ctx, xStart: getTimePixel(+t), width, height, switchBackground });
        break;
      default:
        break;
    }
  }

  tracks?.forEach((_, index) => {
    const trackTranslate = index === 0 ? CANVAS_PADDING : TRACK_HEIGHT_CONTAINER;
    ctx.translate(0, trackTranslate);
    drawTrack({
      ctx,
      width,
      getTimePixel,
      labelMarks,
    });
  });
  ctx.restore();
};
