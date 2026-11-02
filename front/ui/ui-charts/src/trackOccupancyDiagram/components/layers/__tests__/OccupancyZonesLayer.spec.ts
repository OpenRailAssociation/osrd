import { describe, expect, it } from 'vitest';

import { CANVAS_PADDING, OCCUPANCY_ZONE_Y_START } from '../../../lib/consts';
import type { OccupancyZone, Track } from '../../../lib/types';
import { getRenderingInstructions } from '../OccupancyZonesLayer';

const HOUR = 3_600_000;
const TOP_PADDING = 20;
const TRACK_CENTER_Y = TOP_PADDING + CANVAS_PADDING + OCCUPANCY_ZONE_Y_START;

const tracks: Track[] = [{ id: 'J' }];

const makeZone = (pathId: string, startTime: number, endTime: number): OccupancyZone => ({
  pathId,
  trackId: 'J',
  trainName: pathId,
  startTime,
  endTime,
  curveStyle: { color: '#000000', opacity: 1 },
});

/** One short zone per hour, from `firstHour` (included) to `lastHour` (excluded): none of them overlap. */
const makeHourlyZones = (firstHour: number, lastHour: number) =>
  Array.from({ length: lastHour - firstHour }, (_, i) => {
    const hour = firstHour + i;
    return makeZone(`train-${hour}`, hour * HOUR, hour * HOUR + 5 * 60_000);
  });

describe('getRenderingInstructions', () => {
  it('should draw a zone before the time origin in the center of its track', () => {
    const instructions = getRenderingInstructions(
      tracks,
      [makeZone('A', -3 * HOUR, -2 * HOUR)],
      TOP_PADDING
    );

    expect(instructions).toEqual([
      expect.objectContaining({ type: 'occupancyZone', offsetY: TRACK_CENTER_Y }),
    ]);
  });

  it('should draw every zone before the time origin when they do not overlap', () => {
    const zones = makeHourlyZones(-24, 0);

    const instructions = getRenderingInstructions(tracks, zones, TOP_PADDING);

    expect(instructions).toEqual(
      zones.map(() => expect.objectContaining({ type: 'occupancyZone', offsetY: TRACK_CENTER_Y }))
    );
  });

  it('should treat the zones on each side of the time origin the same way', () => {
    const before = getRenderingInstructions(tracks, makeHourlyZones(-12, 0), TOP_PADDING);
    const after = getRenderingInstructions(tracks, makeHourlyZones(0, 12), TOP_PADDING);

    expect(before.map(({ type, offsetY }) => ({ type, offsetY }))).toEqual(
      after.map(({ type, offsetY }) => ({ type, offsetY }))
    );
  });

  it('should stack overlapping zones and box the ones past the maximum', () => {
    // 11 zones all overlapping over the same hour, before the time origin
    const zones = Array.from({ length: 11 }, (_, i) => makeZone(`train-${i}`, -HOUR + i, 0));

    const instructions = getRenderingInstructions(tracks, zones, TOP_PADDING);

    expect(instructions.filter(({ type }) => type === 'occupancyZone')).toHaveLength(9);
    expect(instructions.filter(({ type }) => type === 'remainingTrains')).toEqual([
      expect.objectContaining({ type: 'remainingTrains', amount: 2 }),
    ]);
  });
});
