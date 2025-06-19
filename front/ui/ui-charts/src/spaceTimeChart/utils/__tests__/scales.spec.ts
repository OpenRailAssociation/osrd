import { describe, it, expect } from 'vitest';

import { computeRectZoomOffsets, sideOffset } from '../scales';

const CHART_WIDTH_PX = 100;
const CHART_HEIGHT_PX = 100;

describe('computeRectZoomOffsets', () => {
  const rect = {
    timeStart: new Date(1000),
    timeEnd: new Date(2000),
    spaceStart: 0,
    spaceEnd: 1000,
  };
  const timeOrigin = 0;
  const spaceOrigin = 0;
  const newTimeScale = 50;
  const newSpaceScale = 200;
  describe('normal case', () => {
    describe('x time axis', () => {
      it('should return correct x and y offsets', () => {
        const { xOffset, yOffset } = computeRectZoomOffsets({
          timeOrigin,
          spaceOrigin,
          rect,
          newTimeScale,
          newSpaceScale,
          swapAxes: false,
          chartWidth: CHART_WIDTH_PX,
          chartHeight: CHART_HEIGHT_PX,
        });
        expect({ xOffset, yOffset }).toEqual({ xOffset: 20, yOffset: 47.5 });
      });
    });
    describe('y time axis', () => {
      it('should return correct x and y offsets', () => {
        const { xOffset, yOffset } = computeRectZoomOffsets({
          timeOrigin,
          spaceOrigin,
          rect,
          newTimeScale,
          newSpaceScale,
          swapAxes: true,
          chartWidth: CHART_WIDTH_PX,
          chartHeight: CHART_HEIGHT_PX,
        });
        expect({ xOffset, yOffset }).toEqual({ xOffset: 47.5, yOffset: 20 });
      });
    });
  });
});

describe('sideOffset', () => {
  // we draw a rectangle, vertically from 500 to 1500 mm on the chart.
  // for 500 mm to be at the top of the screen after zoom
  // this means shifting up 50 px
  const rect = {
    timeStart: new Date(1000),
    timeEnd: new Date(2000),
    spaceStart: 500, // mm
    spaceEnd: 1500, // mm
  };
  const spaceOrigin = 0;
  const newSpaceScale = 10;
  describe('no padding', () => {
    it('should return correct y offsets', () => {
      const newYOffset = sideOffset(
        spaceOrigin,
        newSpaceScale,
        rect.spaceStart,
        rect.spaceEnd,
        CHART_HEIGHT_PX
      );
      expect(newYOffset).toEqual(-50);
    });
  });
  describe('with padding', () => {
    it('should return correct y offsets', () => {
      const padding = 10;
      const newYOffset = sideOffset(
        spaceOrigin,
        newSpaceScale,
        rect.spaceStart,
        rect.spaceEnd,
        CHART_HEIGHT_PX,
        padding
      );
      expect(newYOffset).toEqual(-70);
    });
  });
});
