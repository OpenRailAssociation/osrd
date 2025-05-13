import { describe, it, expect } from 'vitest';

import { computeRectZoomOffsets } from '../scales';

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
