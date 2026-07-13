import { describe, it, expect } from 'vitest';

import type { PacedTrainWithDetails, SimulatedException } from 'modules/trainSchedule/types';
import { Duration } from 'utils/duration';
import {
  formatEditoastIdToIndexedOccurrenceId,
  formatEditoastIdToExceptionId,
} from 'utils/trainId';

import { generateBareOccurrences, type BareOccurrence } from '../generateBareOccurrences';

const pacedTrain: Pick<PacedTrainWithDetails, 'id' | 'startTime' | 'paced'> = {
  id: 6,
  startTime: new Date('1996-05-28T09:10:00Z'),
  paced: {
    timeWindow: new Duration({ hours: 2 }),
    interval: new Duration({ minutes: 42 }),
    exceptions: [],
  },
};

const baseOccurrences: BareOccurrence[] = [
  {
    id: formatEditoastIdToIndexedOccurrenceId({ trainScheduleId: 6, occurrenceIndex: 0 }),
    startTime: new Date('1996-05-28T09:10:00Z'),
    exception: undefined,
  },
  {
    id: formatEditoastIdToIndexedOccurrenceId({ trainScheduleId: 6, occurrenceIndex: 1 }),
    startTime: new Date('1996-05-28T09:52:00Z'),
    exception: undefined,
  },
  {
    id: formatEditoastIdToIndexedOccurrenceId({ trainScheduleId: 6, occurrenceIndex: 2 }),
    startTime: new Date('1996-05-28T10:34:00Z'),
    exception: undefined,
  },
];

describe('generateBareOccurrences', () => {
  it('should generate occurrences without exceptions', () => {
    const occurrences = generateBareOccurrences(pacedTrain);
    expect(occurrences).toEqual(baseOccurrences);
  });

  it('should generate occurrences with an added exception', () => {
    const exceptionStartTime = new Date('1996-05-28T10:01:00Z');
    const exception: SimulatedException = {
      id: 60,
      key: 'foo',
      start_time: { value: exceptionStartTime.getTime() },
    };
    const occurrences = generateBareOccurrences({
      ...pacedTrain,
      paced: {
        ...pacedTrain.paced,
        exceptions: [exception],
      },
    });
    expect(occurrences).toEqual([
      ...baseOccurrences,
      {
        id: formatEditoastIdToExceptionId({ trainScheduleId: 6, exceptionId: 60 }),
        startTime: exceptionStartTime,
        exception,
      },
    ]);
  });

  it('should generate occurrences with a modified exception for start time', () => {
    const exceptionStartTime = new Date('1996-05-28T10:01:00Z');
    const exception: SimulatedException = {
      id: 60,
      key: 'foo',
      occurrence_index: 2,
      start_time: { value: exceptionStartTime.getTime() },
    };
    const occurrences = generateBareOccurrences({
      ...pacedTrain,
      paced: {
        ...pacedTrain.paced,
        exceptions: [exception],
      },
    });
    expect(occurrences).toEqual([
      baseOccurrences[0],
      baseOccurrences[1],
      {
        id: baseOccurrences[2].id,
        startTime: exceptionStartTime,
        exception,
      },
    ]);
  });

  it('should generate occurrences with a disabled exception', () => {
    const exception: SimulatedException = {
      id: 60,
      key: 'foo',
      occurrence_index: 1,
      disabled: true,
    };
    const occurrences = generateBareOccurrences({
      ...pacedTrain,
      paced: {
        ...pacedTrain.paced,
        exceptions: [exception],
      },
    });
    expect(occurrences).toEqual([
      baseOccurrences[0],
      {
        ...baseOccurrences[1],
        exception,
      },
      baseOccurrences[2],
    ]);
  });
});
