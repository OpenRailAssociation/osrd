import { MINUTES_TEXT_OFFSET, STATION_TEXT_OFFSET, FONTS, COLORS } from '../../../lib/consts';
import type { OccupancyZone } from '../../../lib/types';
import { drawText } from '../../utils';

const BREAKPOINTS = {
  medium: 24,
  small: 4,
};
const STROKE_WIDTH = 4;
const X_BACKGROUND_PADDING = 2;
const X_INITIAL_POSITION_OFFSET = 4;
const X_MEDIUM_POSITION_OFFSET_BACKGROUND = 12;
const Y_INITIAL_POSITION_OFFSET = 20;
const Y_INITIAL_POSITION_OFFSET_BACKGROUND = 16;
const Y_TEXT_CENTERING_OFFSET = 1;
const X_THROUGHTRAIN_OFFSET = 4;
const Y_MEDIUM_POSITION_OFFSET = 24;
const ROTATE_VALUE = (-30 * Math.PI) / 180;

const { SANS, MONO } = FONTS;
const { GREY_50, GREY_60, GREY_80 } = COLORS;

export const drawOccupancyZonesTexts = ({
  ctx,
  zone,
  arrivalTimePixel,
  departureTimePixel,
  yPosition,
  isThroughTrain,
}: {
  ctx: CanvasRenderingContext2D;
  zone: OccupancyZone;
  arrivalTimePixel: number;
  departureTimePixel: number;
  yPosition: number;
  isThroughTrain: boolean;
}) => {
  const labelStyle = zone.curveStyle.label;
  const labelFontWeight = labelStyle?.fontWeight ?? 400;

  const zoneOccupancyLength = departureTimePixel - arrivalTimePixel - STROKE_WIDTH;

  const isBelowBreakpoint = (breakpoint: keyof typeof BREAKPOINTS) =>
    zoneOccupancyLength < BREAKPOINTS[breakpoint];

  ctx.font = MONO;
  const originTextLength = ctx.measureText(zone.originStation || '--').width;
  ctx.font = `${labelFontWeight} 12px IBM Plex Sans`;
  const nameTextLength = ctx.measureText(zone.trainName).width;

  const { xOriginTrainName, yOriginTrainName } = isBelowBreakpoint('medium')
    ? {
        xOriginTrainName:
          arrivalTimePixel -
          originTextLength +
          STROKE_WIDTH -
          (isThroughTrain ? X_MEDIUM_POSITION_OFFSET_BACKGROUND / 2 : 0),
        yOriginTrainName: yPosition - Y_MEDIUM_POSITION_OFFSET,
      }
    : {
        xOriginTrainName: arrivalTimePixel + X_INITIAL_POSITION_OFFSET,
        yOriginTrainName: yPosition - Y_INITIAL_POSITION_OFFSET,
      };

  const xArrivalPosition = isBelowBreakpoint('small') ? 'right' : 'center';
  const xDeparturePosition = isBelowBreakpoint('small') ? 'left' : 'center';

  const hasLabelBackground = !!labelStyle?.background;
  const textStroke = {
    color: 'transparent',
    width: STROKE_WIDTH,
  };

  // train name background
  if (hasLabelBackground) {
    ctx.save();
    ctx.translate(xOriginTrainName, yOriginTrainName);
    ctx.rotate(ROTATE_VALUE);
    ctx.fillStyle = labelStyle!.background!.color;
    ctx.beginPath();
    ctx.roundRect(
      -X_BACKGROUND_PADDING,
      -Y_INITIAL_POSITION_OFFSET_BACKGROUND / 2 - Y_TEXT_CENTERING_OFFSET,
      nameTextLength + X_BACKGROUND_PADDING * 2,
      Y_INITIAL_POSITION_OFFSET_BACKGROUND,
      2
    );
    ctx.fill();
    ctx.globalAlpha = 1;
    if (labelStyle?.background?.border) {
      ctx.strokeStyle = labelStyle.background.border;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.restore();
  }

  drawText({
    ctx,
    text: zone.trainName,
    x: xOriginTrainName,
    y: yOriginTrainName,
    color: labelStyle?.color || GREY_50,
    font: `${labelFontWeight} 12px IBM Plex Sans`,
    rotateAngle: ROTATE_VALUE,
    yPosition: 'middle',
    stroke: textStroke,
  });

  // arrival minutes & departure minutes
  drawText({
    ctx,
    text: new Date(zone.startTime)
      .getMinutes()
      .toLocaleString('fr-FR', { minimumIntegerDigits: 2 }),
    x: isThroughTrain ? arrivalTimePixel - X_THROUGHTRAIN_OFFSET : arrivalTimePixel,
    y: yPosition + MINUTES_TEXT_OFFSET,
    color: GREY_80,
    xPosition: xArrivalPosition,
    yPosition: 'top',
    font: SANS,
    stroke: textStroke,
  });

  if (!isThroughTrain)
    drawText({
      ctx,
      text: new Date(zone.endTime)
        .getMinutes()
        .toLocaleString('fr-FR', { minimumIntegerDigits: 2 }),
      x: departureTimePixel,
      y: yPosition + MINUTES_TEXT_OFFSET,
      color: GREY_80,
      xPosition: xDeparturePosition,
      yPosition: 'top',
      font: SANS,
      stroke: textStroke,
    });

  // origin & destination
  drawText({
    ctx,
    text: zone.originStation || '--',
    x: isThroughTrain ? arrivalTimePixel - X_THROUGHTRAIN_OFFSET : arrivalTimePixel,
    y: yPosition - STATION_TEXT_OFFSET,
    color: GREY_60,
    xPosition: 'right',
    yPosition: 'bottom',
    font: `${labelFontWeight} 10px IBM Plex Mono`,
    stroke: textStroke,
  });

  drawText({
    ctx,
    text: zone.destinationStation || '--',
    x: isThroughTrain ? departureTimePixel + X_THROUGHTRAIN_OFFSET : departureTimePixel,
    y: yPosition - STATION_TEXT_OFFSET,
    color: GREY_60,
    xPosition: 'left',
    yPosition: 'bottom',
    font: `${labelFontWeight} 10px IBM Plex Mono`,
    stroke: textStroke,
  });
};
