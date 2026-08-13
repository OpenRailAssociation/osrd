import { describe, it, expect } from 'vitest';

import type { PostTrainSchedulesLinkingsApiResponse } from 'common/api/osrdEditoastApi';
import {
  formatEditoastIdToExceptionId,
  formatEditoastIdToIndexedOccurrenceId,
  formatEditoastIdToTrainScheduleId,
} from 'utils/trainId';

import {
  formatTrainIdToLinkingOccurrence,
  parseLinkingOccurrence,
  parseLinkings,
} from '../linkings';

const TRAIN_1 = formatEditoastIdToTrainScheduleId(1);

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
