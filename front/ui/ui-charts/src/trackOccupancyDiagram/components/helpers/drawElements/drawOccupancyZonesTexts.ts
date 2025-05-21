import { MINUTES_TEXT_OFFSET, STATION_TEXT_OFFSET, FONTS, COLORS } from '../../consts';
import type { OccupancyZone } from '../../types';
import { drawText } from '../../utils';

const BREAKPOINTS = {
  medium: 24,
  small: 4,
};
const STROKE_WIDTH = 4;
const X_BACKGROUND_PADDING = 4;
const X_INITIAL_POSITION_OFFSET = 8;
const X_MEDIUM_POSITION_OFFSET_BACKGROUND = 12;
const Y_INITIAL_POSITION_OFFSET = 5;
const Y_INITIAL_POSITION_OFFSET_BACKGROUND = 18;
const X_SELECTED_MEDIUM_PADDING = 8;
const X_THROUGHTRAIN_OFFSET = 4;
const Y_MEDIUM_POSITION_OFFSET_BACKGROUND = 28;
const Y_MEDIUM_POSITION_OFFSET = 14;
const ROTATE_VALUE = (-30 * Math.PI) / 180;

const { SANS, MONO } = FONTS;
const { WHITE_100, GREY_50, GREY_60, GREY_80, SELECTION_20 } = COLORS;

export const drawOccupancyZonesTexts = ({
  ctx,
  zone,
  arrivalTimePixel,
  departureTimePixel,
  yPosition,
  isThroughTrain,
  isSelected,
}: {
  ctx: CanvasRenderingContext2D;
  zone: OccupancyZone;
  arrivalTimePixel: number;
  departureTimePixel: number;
  yPosition: number;
  isThroughTrain: boolean;
  isSelected?: boolean;
}) => {
  const zoneOccupancyLength = departureTimePixel - arrivalTimePixel - STROKE_WIDTH;

  const isBelowBreakpoint = (breakpoint: keyof typeof BREAKPOINTS) =>
    zoneOccupancyLength < BREAKPOINTS[breakpoint];

  ctx.font = '400 10px IBM Plex Mono';
  const originTextLength = ctx.measureText(zone.originStation || '--').width;
  ctx.font = '400 12px IBM Plex Mono';
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

  const textStroke = {
    color: isSelected ? 'transparent' : WHITE_100,
    width: STROKE_WIDTH,
  };

  // train name
  if (isSelected) {
    const { xSelectedTrainNameBackground, ySelectedTrainNameBackground } = isBelowBreakpoint(
      'medium'
    )
      ? {
          xSelectedTrainNameBackground: xOriginTrainName - X_SELECTED_MEDIUM_PADDING,
          ySelectedTrainNameBackground: yPosition - Y_MEDIUM_POSITION_OFFSET_BACKGROUND,
        }
      : {
          xSelectedTrainNameBackground: arrivalTimePixel,
          ySelectedTrainNameBackground: yPosition - Y_INITIAL_POSITION_OFFSET_BACKGROUND,
        };

    ctx.save();
    ctx.translate(xSelectedTrainNameBackground, ySelectedTrainNameBackground);
    ctx.rotate(ROTATE_VALUE);
    ctx.fillStyle = SELECTION_20;
    ctx.beginPath();
    ctx.roundRect(
      -X_BACKGROUND_PADDING,
      0,
      nameTextLength + X_BACKGROUND_PADDING * 2,
      Y_INITIAL_POSITION_OFFSET_BACKGROUND
    );
    ctx.fill();
    ctx.restore();
  }

  drawText({
    ctx,
    text: zone.trainName,
    x: xOriginTrainName,
    y: yOriginTrainName,
    color: GREY_50,
    rotateAngle: ROTATE_VALUE,
    stroke: {
      color: WHITE_100,
      width: STROKE_WIDTH,
    },
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
    font: MONO,
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
    font: MONO,
    stroke: textStroke,
  });
};
