import { describe, it, expect } from 'vitest';

import type { PostTrainSchedulesLinkingsApiResponse } from 'common/api/osrdEditoastApi';
import type { TrainId } from 'reducers/osrdconf/types';
import {
  formatEditoastIdToExceptionId,
  formatEditoastIdToIndexedOccurrenceId,
  formatEditoastIdToTrainScheduleId,
} from 'utils/trainId';

import buildWaypointLinkings, {
  formatLinkingId,
  formatTrainIdToLinkingOccurrence,
  parseLinkingId,
  parseLinkingOccurrence,
  parseLinkings,
  type ExistingLinking,
} from '../linkings';
import type { MovableOccupancyZone } from '../zones';

const TRAIN_1 = formatEditoastIdToTrainScheduleId(1);
const TRAIN_2 = formatEditoastIdToTrainScheduleId(2);

describe('formatTrainIdToLinkingOccurrence', () => {
  const OCCURRENCE = formatEditoastIdToIndexedOccurrenceId({
    trainScheduleId: 1,
    occurrenceIndex: 0,
  });
  const ADDED_OCCURRENCE = formatEditoastIdToExceptionId({ trainScheduleId: 1, exceptionId: 7 });

  it('should reference a unique train by its train schedule', () => {
    expect(formatTrainIdToLinkingOccurrence(TRAIN_1)).toEqual({
      type: 'unique',
      train_schedule_id: 1,
    });
  });

  it('should reference an occurrence by its index', () => {
    expect(formatTrainIdToLinkingOccurrence(OCCURRENCE)).toEqual({
      type: 'paced_occurrence',
      train_schedule_id: 1,
      occurrence_index: 0,
    });
  });

  it('should reference an added occurrence by its exception', () => {
    expect(formatTrainIdToLinkingOccurrence(ADDED_OCCURRENCE)).toEqual({
      type: 'added_exception',
      train_schedule_id: 1,
      added_exception_id: 7,
    });
  });

  it.each([
    ['a unique train', TRAIN_1],
    ['an occurrence', OCCURRENCE],
    ['an added occurrence', ADDED_OCCURRENCE],
  ])('should parse back the reference of %s', (_, trainId) => {
    expect(parseLinkingOccurrence(formatTrainIdToLinkingOccurrence(trainId))).toBe(trainId);
  });
});

describe('parseLinkings', () => {
  const LINKING: PostTrainSchedulesLinkingsApiResponse[number] = {
    id: 42,
    source: { type: 'unique', train_schedule_id: 1 },
    target: { type: 'paced_occurrence', train_schedule_id: 2, occurrence_index: 3 },
  };

  it('should convert both ends to train IDs', () => {
    expect(parseLinkings([LINKING])).toEqual([
      {
        id: 42,
        source: formatEditoastIdToTrainScheduleId(1),
        target: formatEditoastIdToIndexedOccurrenceId({ trainScheduleId: 2, occurrenceIndex: 3 }),
      },
    ]);
  });
});

describe('parseLinkingId', () => {
  it('should parse back the ID of an existing linking', () => {
    expect(parseLinkingId(formatLinkingId({ linkingId: 42 }))).toEqual({ linkingId: 42 });
  });

  it('should parse back the pair of a linking to create', () => {
    const pair = { source: TRAIN_1, target: TRAIN_2 };

    expect(parseLinkingId(formatLinkingId(pair))).toEqual(pair);
  });

  it('should throw on an ID which is not a linking reference', () => {
    expect(() => parseLinkingId('not json')).toThrow('invalid JSON');
    expect(() => parseLinkingId(JSON.stringify({ source: TRAIN_1 }))).toThrow('invalid fields');
    expect(() => parseLinkingId(JSON.stringify({ linkingId: '42' }))).toThrow('invalid fields');
  });
});

describe('buildWaypointLinkings', () => {
  const MINUTE = 60_000;
  const TRACK_A = 'trackSection_a';
  const TRACK_B = 'trackSection_b';

  const zone = ({
    trainId,
    blockType,
    trackId = TRACK_A,
    startTime,
    endTime,
  }: {
    trainId: TrainId;
    blockType: MovableOccupancyZone['blockType'];
    trackId?: string;
    startTime: number;
    endTime: number;
  }): MovableOccupancyZone =>
    ({
      trainId,
      trackId,
      blockType,
      startTime,
      endTime,
      active: true,
    }) as MovableOccupancyZone;

  const ARRIVAL = zone({
    trainId: TRAIN_1,
    blockType: 'incoming',
    startTime: 0,
    endTime: 10 * MINUTE,
  });
  const DEPARTURE = zone({
    trainId: TRAIN_2,
    blockType: 'outgoing',
    startTime: 30 * MINUTE,
    endTime: 40 * MINUTE,
  });

  const POSSIBLE = new Map([[TRAIN_1, TRAIN_2]]);
  const TRAIN_NAMES: Partial<Record<TrainId, string>> = { [TRAIN_1]: '4655', [TRAIN_2]: '8795' };
  const EXISTING: ExistingLinking[] = [{ id: 42, source: TRAIN_1, target: TRAIN_2 }];

  const buildLinkings = ({
    zones = [ARRIVAL, DEPARTURE],
    possibleLinkings = POSSIBLE,
    existingLinkings = [] as ExistingLinking[],
    showSuggestions = false,
  }) =>
    buildWaypointLinkings({
      zones,
      possibleLinkings,
      existingLinkings,
      trainNames: (trainId: TrainId) => TRAIN_NAMES[trainId],
      showSuggestions,
    });

  it('should draw an existing linking between the two occupancies it links', () => {
    const { linkings, brokenLinkings } = buildLinkings({ existingLinkings: EXISTING });

    expect(brokenLinkings).toEqual([]);
    expect(linkings).toEqual([
      {
        id: formatLinkingId({ linkingId: 42 }),
        targetTrainId: TRAIN_2,
        trackId: TRACK_A,
        startTime: ARRIVAL.endTime,
        endTime: DEPARTURE.startTime,
      },
    ]);
  });

  it('should not suggest any linking while the linking mode is off', () => {
    expect(buildLinkings({ showSuggestions: false }).linkings).toEqual([]);
  });

  it('should suggest a possible linking while the linking mode is on', () => {
    const { linkings } = buildLinkings({ showSuggestions: true });

    expect(linkings).toEqual([
      {
        id: formatLinkingId({ source: TRAIN_1, target: TRAIN_2 }),
        targetTrainId: TRAIN_2,
        trackId: TRACK_A,
        startTime: ARRIVAL.endTime,
        endTime: DEPARTURE.startTime,
        suggested: true,
      },
    ]);
  });

  it('should not suggest a linking which already exists', () => {
    const { linkings } = buildLinkings({ existingLinkings: EXISTING, showSuggestions: true });

    expect(linkings).toHaveLength(1);
    expect(linkings[0].suggested).toBeUndefined();
  });

  it('should not suggest a linking whose target is already linked to another train', () => {
    const otherSource = formatEditoastIdToTrainScheduleId(3);
    const { linkings } = buildLinkings({
      existingLinkings: [{ id: 42, source: otherSource, target: TRAIN_2 }],
      showSuggestions: true,
    });

    expect(linkings).toEqual([]);
  });

  it('should break an existing linking whose ends are not linkable anymore', () => {
    const { linkings, brokenLinkings } = buildLinkings({
      possibleLinkings: new Map(),
      existingLinkings: EXISTING,
    });

    expect(linkings).toEqual([]);
    expect(brokenLinkings).toEqual([
      {
        id: formatLinkingId({ linkingId: 42 }),
        trackId: TRACK_A,
        direction: 'forward',
        time: ARRIVAL.endTime,
        name: '8795',
      },
      {
        id: formatLinkingId({ linkingId: 42 }),
        trackId: TRACK_A,
        direction: 'backward',
        time: DEPARTURE.startTime,
        name: '4655',
      },
    ]);
  });

  it('should break an existing linking on the only end which occupies a track here', () => {
    const { brokenLinkings } = buildLinkings({
      zones: [ARRIVAL],
      possibleLinkings: new Map(),
      existingLinkings: EXISTING,
    });

    expect(brokenLinkings).toEqual([
      {
        id: formatLinkingId({ linkingId: 42 }),
        trackId: TRACK_A,
        direction: 'forward',
        time: ARRIVAL.endTime,
        name: '8795',
      },
    ]);
  });

  it('should draw nothing for a linking whose trains both stop elsewhere', () => {
    const { linkings, brokenLinkings } = buildLinkings({
      zones: [
        zone({ trainId: TRAIN_1, blockType: 'via', startTime: 0, endTime: MINUTE }),
        zone({ trainId: TRAIN_2, blockType: 'via', startTime: 2 * MINUTE, endTime: 3 * MINUTE }),
      ],
      possibleLinkings: new Map(),
      existingLinkings: EXISTING,
    });

    expect(linkings).toEqual([]);
    expect(brokenLinkings).toEqual([]);
  });

  it('should anchor each broken end on the track it occupies', () => {
    const { brokenLinkings } = buildLinkings({
      zones: [ARRIVAL, { ...DEPARTURE, trackId: TRACK_B }],
      possibleLinkings: new Map(),
      existingLinkings: EXISTING,
    });

    expect(brokenLinkings.map(({ trackId }) => trackId)).toEqual([TRACK_A, TRACK_B]);
  });
});
