import { readFile } from 'node:fs/promises';

import type { NetzgrafikDto, NodeDto, TrainrunSectionDto } from '@osrd-project/netzgrafik-frontend';
import { describe, expect, test, vi } from 'vitest';

import { Duration } from 'utils/duration';

import { TRAINRUN_CATEGORY_HALTEZEITEN, TRAINRUN_DIRECTIONS } from '../consts';
import { convertNgeDtoToOsrd } from '../ngeToOsrd';
import { generatePathAndSchedule } from '../ngeToOsrd/trainrun';

async function readJsonFile(path: string): Promise<unknown> {
  return JSON.parse(await readFile(new URL(path, import.meta.url).pathname, 'utf-8'));
}

vi.setSystemTime(new Date('2025-06-25T13:00:00.000Z'));

const FIXTURES = ['roundTrip', 'oneWay', 'duplicateTrigrams', 'discontinuousTrainrun'];

describe('convertNgeDtoToOsrd', () => {
  test.each(FIXTURES)('ngeToOsrd-inputDto-$0', async (name) => {
    const dto = (await readJsonFile(`./ngeToOsrd-inputDto-${name}.json`)) as NetzgrafikDto;
    const expected = await readJsonFile(`./ngeToOsrd-output-${name}.json`);
    const result = convertNgeDtoToOsrd(dto);
    // Go through JSON encoding to discard undefined fields
    expect(JSON.parse(JSON.stringify(result))).toEqual(expected);
  });
});

describe('generatPathAndSchedule', () => {
  const nodes: NodeDto[] = [
    {
      id: 7,
      betriebspunktName: 'RTR',
      fullName: 'Rothrist',
      positionX: 320,
      positionY: 32,
      ports: [{ id: 6, trainrunSectionId: 3, positionIndex: 0, positionAlignment: 1 }],
      transitions: [],
      connections: [],
      resourceId: 8,
      perronkanten: 5,
      connectionTime: null,
      trainrunCategoryHaltezeiten: TRAINRUN_CATEGORY_HALTEZEITEN,
      symmetryAxis: 0,
      warnings: [],
      labelIds: [],
      isCollapsed: false,
    },
    {
      id: 8,
      betriebspunktName: 'LTH',
      fullName: 'Langenthal',
      positionX: 320,
      positionY: 192,
      ports: [{ id: 5, trainrunSectionId: 3, positionIndex: 0, positionAlignment: 0 }],
      transitions: [],
      connections: [],
      resourceId: 9,
      perronkanten: 5,
      connectionTime: null,
      trainrunCategoryHaltezeiten: TRAINRUN_CATEGORY_HALTEZEITEN,
      symmetryAxis: 0,
      warnings: [],
      labelIds: [],
      isCollapsed: false,
    },
  ];

  const sections: TrainrunSectionDto[] = [
    {
      id: 3,
      sourceNodeId: 7,
      sourcePortId: 6,
      targetNodeId: 8,
      targetPortId: 5,
      travelTime: { time: 2, consecutiveTime: 2, lock: true },
      backwardTravelTime: { time: 2, consecutiveTime: 2, lock: true },
      sourceDeparture: { time: 59, consecutiveTime: 59, lock: false },
      sourceArrival: { time: null, consecutiveTime: null, lock: false },
      targetDeparture: { time: null, consecutiveTime: null, lock: false },
      targetArrival: { time: 1, consecutiveTime: 61, lock: false },
      sourceSymmetry: true,
      targetSymmetry: true,
      numberOfStops: 0,
      trainrunId: 2,
      resourceId: 0,
      specificTrainrunSectionFrequencyId: null,
      warnings: [],
    },
  ];

  const expectedPath = [
    {
      id: '7-0',
      location: {
        type: 'operational_point_part_reference',
        operational_point: { main_code: 'RTR', country_code: '??', type: 'domestic' },
        local_track_name: null,
      },
    },
    {
      id: '8-1',
      location: {
        type: 'operational_point_part_reference',
        operational_point: { main_code: 'LTH', country_code: '??', type: 'domestic' },
        local_track_name: null,
      },
    },
  ];

  const expectedSchedule = [
    {
      at: '8-1',
      arrival: new Duration({ minutes: 2 }).toISOString(),
      stop_for: Duration.zero.toISOString(),
      reception_signal: 'OPEN',
    },
  ];

  test('should generate an absolute start time for a calendar timetable', () => {
    const result = generatePathAndSchedule(
      sections,
      nodes,
      new Date(2026, 0, 15, 3, 0),
      TRAINRUN_DIRECTIONS.FORWARD,
      null
    );

    expect(result).toEqual({
      start_time: new Date(2026, 0, 15, 3, 59).getTime(),
      path: expectedPath,
      schedule: expectedSchedule,
    });
  });

  test('should generate a relative start time for an hourly timetable', () => {
    const result = generatePathAndSchedule(
      sections,
      nodes,
      new Duration({ hours: 3 }),
      TRAINRUN_DIRECTIONS.FORWARD,
      null
    );

    expect(result).toEqual({
      start_time: new Duration({ hours: 3, minutes: 59 }).ms,
      path: expectedPath,
      schedule: expectedSchedule,
    });
  });

  test('should clamp the start time to the train interval for a paced train in an hourly timetable', () => {
    const result = generatePathAndSchedule(
      sections,
      nodes,
      new Duration({ hours: 3 }),
      TRAINRUN_DIRECTIONS.FORWARD,
      { interval: 'PT30M', time_window: 'PT3H', exceptions: [] }
    );

    expect(result).toEqual({
      start_time: new Duration({ minutes: 29 }).ms,
      path: expectedPath,
      schedule: expectedSchedule,
    });
  });

  test('should not clamp the start time to the train interval for a paced train in a calendar timetable', () => {
    const result = generatePathAndSchedule(
      sections,
      nodes,
      new Date(2026, 0, 15, 3, 0),
      TRAINRUN_DIRECTIONS.FORWARD,
      { interval: 'PT30M', time_window: 'PT3H', exceptions: [] }
    );

    expect(result).toEqual({
      start_time: new Date(2026, 0, 15, 3, 59).getTime(),
      path: expectedPath,
      schedule: expectedSchedule,
    });
  });
});
