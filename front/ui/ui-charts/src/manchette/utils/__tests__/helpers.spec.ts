import { describe, it, test, expect } from 'vitest';

import { MAX_ZOOM_Y, MIN_ZOOM_Y } from '../../consts';
import {
  selectWaypointsToDisplay,
  getScales,
  getExtremaScales,
  spaceScaleToZoomValue,
  zoomValueToSpaceScale,
} from '../helpers';

// Mock data for the tests
const mockedWaypoints = [
  { position: 0, id: 'waypoint-1' },
  { position: 100_000_000, id: 'waypoint-2' },
  { position: 200_000_000, id: 'waypoint-3' },
];

describe('selectWaypointsToDisplay', () => {
  it('should ensure that an empty array is returned when there is only 1 waypoint', () => {
    const result = selectWaypointsToDisplay([mockedWaypoints[0]], {
      isProportional: true,
      spaceScale: 1_000, // 1 meter per pixel
    });
    expect(result.length).toBe(0);
  });

  it('should display all points for non-proportional display', () => {
    const result = selectWaypointsToDisplay(mockedWaypoints, {
      isProportional: false,
      spaceScale: 1_000,
    });
    expect(result).toHaveLength(mockedWaypoints.length);
  });

  it('should correctly filter waypoints', () => {
    // spaceScale 10 km/px, so consecutive waypoints are 10px apart (< 32px)
    // -> waypoint-2 is hidden
    const result = selectWaypointsToDisplay(mockedWaypoints, {
      isProportional: true,
      spaceScale: 10_000_000,
    });
    expect(result).toHaveLength(2);
  });

  it('should return correct heights for proportional display, zoom 1', () => {
    // spaceScale 1 km/px, so consecutive waypoints are 100px apart (> 32px)
    // -> all waypoints shown
    const result = selectWaypointsToDisplay(mockedWaypoints, {
      isProportional: true,
      spaceScale: 1_000_000,
    });
    expect(result).toHaveLength(mockedWaypoints.length);
  });

  it('should return correct heights for proportional display, zoom 2', () => {
    // spaceScale 0.5 km/px, so consecutive waypoints are 200px apart (> 32px)
    // -> all waypoints shown
    const result = selectWaypointsToDisplay(mockedWaypoints, {
      isProportional: true,
      spaceScale: 500_000,
    });
    expect(result).toHaveLength(mockedWaypoints.length);
  });

  it('should ensure the last point is always displayed', () => {
    const result = selectWaypointsToDisplay(mockedWaypoints, {
      isProportional: true,
      spaceScale: 10_000_000,
    });
    expect(result.at(-1)?.id).toBe('waypoint-3');
  });

  it('should show a waypoint with sufficient pixel spacing at max zoom', () => {
    // At max zoom (small mm/px), waypoint-2 sits ~467px from the origin (> 32px)
    // -> all waypoints shown
    const result = selectWaypointsToDisplay(
      [
        { position: 0, id: 'waypoint-1' },
        { position: 467_290, id: 'waypoint-2' },
        { position: 200_000_000, id: 'waypoint-3' },
      ],
      { isProportional: true, spaceScale: 1_000 }
    );
    expect(result).toHaveLength(3);
  });

  it('should filter a waypoint that would visually overlap at max zoom', () => {
    // waypoint-2 is 500mm from the origin, so 0.5px on screen (< 32px)
    // -> waypoint-2 is hidden
    const result = selectWaypointsToDisplay(
      [
        { position: 0, id: 'waypoint-1' },
        { position: 500, id: 'waypoint-2' },
        { position: 200_000_000, id: 'waypoint-3' },
      ],
      { isProportional: true, spaceScale: 1_000 }
    );
    expect(result).toHaveLength(2);
    expect(result.some((w) => w.id === 'waypoint-2')).toBe(false);
  });

  it('should filter the middle waypoint on a very short path even at max zoom', () => {
    // On a 10m path, waypoint-2 sits 5px from the origin on screen (< 32px)
    // -> waypoint-2 is hidden
    const result = selectWaypointsToDisplay(
      [
        { position: 0, id: 'waypoint-1' },
        { position: 5_000, id: 'waypoint-2' },
        { position: 10_000, id: 'waypoint-3' },
      ],
      { isProportional: true, spaceScale: 1_000 }
    );
    expect(result).toHaveLength(2);
    expect(result.some((w) => w.id === 'waypoint-2')).toBe(false);
  });

  it('should hide a lower-priority waypoint when close to a higher-priority one at low zoom, then show both at higher zoom', () => {
    // waypoint-A (weight 1) and waypoint-B (weight 2) are 3km apart
    const waypoints = [
      { position: 0, id: 'first' },
      { position: 50_000_000, id: 'waypoint-A', weight: 1 },
      { position: 53_000_000, id: 'waypoint-B', weight: 2 },
      { position: 200_000_000, id: 'last' },
    ];

    // Low zoom (large mm/px):
    // A and B are only 3px apart on screen (< 32px) and B wins (higher weight)
    // -> A is hidden
    const lowZoomResult = selectWaypointsToDisplay(waypoints, {
      isProportional: true,
      spaceScale: 1_000_000,
    });
    expect(lowZoomResult).toHaveLength(3);
    expect(lowZoomResult.some((w) => w.id === 'waypoint-A')).toBe(false);
    expect(lowZoomResult.some((w) => w.id === 'waypoint-B')).toBe(true);

    // High zoom (small mm/px):
    // A and B are 3000px apart on screen (> 32px)
    // -> all waypoints shown
    const highZoomResult = selectWaypointsToDisplay(waypoints, {
      isProportional: true,
      spaceScale: 1_000,
    });
    expect(highZoomResult).toHaveLength(4);
    expect(highZoomResult.some((w) => w.id === 'waypoint-A')).toBe(true);
    expect(highZoomResult.some((w) => w.id === 'waypoint-B')).toBe(true);
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
