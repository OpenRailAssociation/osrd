import { describe, it, test, expect } from 'vitest';

import { MAX_ZOOM_Y, MIN_ZOOM_Y } from '../../consts';
import {
  selectWaypointsToDisplay,
  getScales,
  getExtremaScales,
  spaceScaleToZoomValue,
  zoomValueToSpaceScale,
} from '../helpers';

// Assuming these types from your code

// Mock data for the tests
const mockedWaypoints = [
  { position: 0, id: 'waypoint-1' },
  { position: 100_000_000, id: 'waypoint-2' },
  { position: 200_000_000, id: 'waypoint-3' },
];

describe('selectWaypointsToDisplay', () => {
  it('should ensure that an empty array is returned when there is only 1 waypoint', () => {
    const result = selectWaypointsToDisplay([mockedWaypoints[0]], {
      height: 500,
      isProportional: true,
      yZoom: 1,
    });
    expect(result.length).toBe(0);
  });

  it('should display all points for non-proportional display', () => {
    const result = selectWaypointsToDisplay(mockedWaypoints, {
      height: 100,
      isProportional: false,
      yZoom: 1,
    });
    expect(result).toHaveLength(mockedWaypoints.length);
  });

  it('should correctly filter waypoints', () => {
    const result = selectWaypointsToDisplay(mockedWaypoints, {
      height: 100,
      isProportional: true,
      yZoom: 1,
    });
    expect(result).toHaveLength(2);
  });

  it('should return correct heights for proportional display, zoom 1', () => {
    const result = selectWaypointsToDisplay(mockedWaypoints, {
      height: 500,
      isProportional: true,
      yZoom: 1,
    });
    expect(result).toHaveLength(mockedWaypoints.length);
  });

  it('should return correct heights for proportional display, zoom 2', () => {
    const result = selectWaypointsToDisplay(mockedWaypoints, {
      height: 500,
      isProportional: true,
      yZoom: 2,
    });
    expect(result).toHaveLength(mockedWaypoints.length);
  });

  it('should ensure the last point is always displayed', () => {
    const result = selectWaypointsToDisplay(mockedWaypoints, {
      height: 100,
      isProportional: true,
      yZoom: 1,
    });
    expect(result.some((waypoint) => waypoint.id === 'waypoint-3')).toBe(true);
  });
});

describe('getScales', () => {
  const minZoomMillimeterPerPx = 500_000;
  const maxZoomMillimeterPerPx = 1_000;
  const mockOpsWithPosition = mockedWaypoints.map((waypoint) => ({
    id: waypoint.id,
    label: waypoint.id,
    position: waypoint.position,
    importanceLevel: 1,
  }));

  it('should ensure that an empty array is return when there is no waypoint', () => {
    expect(
      getScales(
        [],
        {
          height: 500,
          isProportional: true,
          yZoom: 1,
        },
        minZoomMillimeterPerPx,
        maxZoomMillimeterPerPx
      )
    ).toHaveLength(0);
  });

  it('should return correct one single scale when there is just one waypoint', () => {
    expect(
      getScales(
        [mockOpsWithPosition[0]],
        {
          height: 500,
          isProportional: true,
          yZoom: 1,
        },
        minZoomMillimeterPerPx,
        maxZoomMillimeterPerPx
      )
    ).toEqual([{ from: 0, to: 0, size: 500 }]);
  });

  it('should return correct scale coefficients for proportional display', () => {
    const result = getScales(
      mockOpsWithPosition,
      {
        height: 500,
        isProportional: true,
        yZoom: 1,
      },
      minZoomMillimeterPerPx,
      maxZoomMillimeterPerPx
    );
    expect(result).toEqual([{ from: 0, to: 200000000, coefficient: 500000 }]);
    expect(result[0].size).not.toBeDefined();
  });

  it('should return correct size for non-proportional display', () => {
    const result = getScales(
      mockOpsWithPosition,
      {
        height: 500,
        isProportional: false,
        yZoom: 1,
      },
      minZoomMillimeterPerPx,
      maxZoomMillimeterPerPx
    );

    expect(result).toEqual([
      { from: 0, to: 100000000, size: 32 },
      { from: 100000000, to: 200000000, size: 32 },
    ]);
    expect(result[0]).not.toHaveProperty('coefficient');
  });
});

describe('space scale functions', () => {
  const pathLength = 168056000; // mm
  const drawingHeightWithoutTopPadding = 505;
  const drawingHeightWithoutBothPadding = 489;

  const { minZoomMillimeterPerPx, maxZoomMillimeterPerPx } = getExtremaScales(
    drawingHeightWithoutTopPadding,
    drawingHeightWithoutBothPadding,
    pathLength
  );
  expect(minZoomMillimeterPerPx).toBeCloseTo(343672.801);
  expect(maxZoomMillimeterPerPx).toBeCloseTo(990.1);

  test('zoomValueToSpaceScale', () => {
    expect(
      zoomValueToSpaceScale(minZoomMillimeterPerPx, maxZoomMillimeterPerPx, MIN_ZOOM_Y)
    ).toBeCloseTo(343672.801);
    expect(
      zoomValueToSpaceScale(minZoomMillimeterPerPx, maxZoomMillimeterPerPx, MAX_ZOOM_Y)
    ).toBeCloseTo(990.1);
  });

  test('spaceScaleToZoomValue', () => {
    expect(
      spaceScaleToZoomValue(minZoomMillimeterPerPx, maxZoomMillimeterPerPx, 343672.801)
    ).toBeCloseTo(MIN_ZOOM_Y);
    expect(
      spaceScaleToZoomValue(minZoomMillimeterPerPx, maxZoomMillimeterPerPx, 990.1)
    ).toBeCloseTo(MAX_ZOOM_Y);
  });
});
