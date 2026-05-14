import { describe, it, expect } from 'vitest';

import type { OccurrenceId, TrainScheduleId } from 'reducers/osrdconf/types';
import { Duration } from 'utils/duration';

import {
  formatEditoastIdToIndexedOccurrenceId,
  formatTrainScheduleIdToIndexedOccurrenceId,
  formatEditoastIdToTrainScheduleId,
  extractEditoastIdFromTrainScheduleId,
  extractOccurrenceIndexFromOccurrenceId,
  extractTrainScheduleIdFromOccurrenceId,
  formatEditoastIdToExceptionId,
  extractExceptionIdFromOccurrenceId,
  formatTrainScheduleIdToExceptionId,
  isTrainIdInTimetable,
} from '../trainId';

describe('formatEditoastIdToTrainScheduleId', () => {
  it('should format to a TrainScheduleId', () => {
    const trainId = 123;
    const result = formatEditoastIdToTrainScheduleId(trainId);
    expect(result).toEqual(`trainSchedule_${trainId}`);
  });
});

describe('formatEditoastIdToIndexedOccurrenceId', () => {
  it('should format a valid train schedule ID and occurrence index correctly', () => {
    const trainScheduleId = 123;
    const occurrenceIndex = 1;
    const result = formatEditoastIdToIndexedOccurrenceId({ trainScheduleId, occurrenceIndex });
    expect(result).toBe(`indexedoccurrence_${trainScheduleId}_${occurrenceIndex}`);
  });
});

describe('formatEditoastIdToExceptionId', () => {
  it('should format a valid train schedule ID and occurrence index correctly', () => {
    const trainScheduleId = 123;
    const exceptionId = 1;
    const result = formatEditoastIdToExceptionId({ trainScheduleId, exceptionId });
    expect(result).toBe(`exception_${trainScheduleId}_${exceptionId}`);
  });
});

describe('extractEditoastIdFromTrainScheduleId', () => {
  it('should return a valid editoast id', () => {
    const trainScheduleId = 'trainSchedule_123' as TrainScheduleId;
    const result = extractEditoastIdFromTrainScheduleId(trainScheduleId);
    expect(result).toBe(123);
  });

  it("should throw an error if the trainScheduleId doesn't start correctly", () => {
    const trainScheduleId = 'invalid_123' as TrainScheduleId;
    expect(() => extractEditoastIdFromTrainScheduleId(trainScheduleId)).toThrow(
      'The train schedule id should start with "trainSchedule_"'
    );
  });

  it("should throw an error if the return train id isn't a number", () => {
    const trainScheduleId = 'trainSchedule_onetwo' as TrainScheduleId;
    expect(() => extractEditoastIdFromTrainScheduleId(trainScheduleId)).toThrow(
      `Invalid train schedule ID: ${trainScheduleId}`
    );
  });
});

describe('formatTrainScheduleIdToIndexedOccurrenceId', () => {
  it('should return the occurrenceId', () => {
    const trainScheduleId = 'trainSchedule_123' as TrainScheduleId;
    const result = formatTrainScheduleIdToIndexedOccurrenceId(trainScheduleId, 0);
    expect(result).toBe('indexedoccurrence_123_0');
  });

  it('should throw if trainScheduleId is invalid', () => {
    const trainScheduleId = 'invalid_trainSchedule_123' as TrainScheduleId;
    expect(() => formatTrainScheduleIdToIndexedOccurrenceId(trainScheduleId, 0)).toThrow(
      'The train schedule id should start with "trainSchedule_"'
    );
  });
});

describe('formatTrainScheduleIdToExceptionId', () => {
  it('should return the exceptionId', () => {
    const trainScheduleId = 'trainSchedule_123' as TrainScheduleId;
    const result = formatTrainScheduleIdToExceptionId(trainScheduleId, 1234);
    expect(result).toBe('exception_123_1234');
  });

  it('should throw if trainScheduleId is invalid', () => {
    const trainScheduleId = 'invalid_trainSchedule_123' as TrainScheduleId;
    expect(() => formatTrainScheduleIdToExceptionId(trainScheduleId, 12345)).toThrow(
      'The train schedule id should start with "trainSchedule_"'
    );
  });
});

describe('extractTrainScheduleIdFromOccurrenceId', () => {
  it('should return the trainScheduleId for a regular occurrence', () => {
    const occurrenceId = 'indexedoccurrence_123_0' as OccurrenceId;
    const result = extractTrainScheduleIdFromOccurrenceId(occurrenceId);
    expect(result).toBe('trainSchedule_123');
  });

  it('should return the trainScheduleId for an added exception', () => {
    const occurrenceId = 'exception_123_0' as OccurrenceId;
    const result = extractTrainScheduleIdFromOccurrenceId(occurrenceId);
    expect(result).toBe('trainSchedule_123');
  });

  it('should throw if the key is invalid', () => {
    const occurrenceId = 'exception-indexedoccurrence_123_0' as OccurrenceId;
    expect(() => extractTrainScheduleIdFromOccurrenceId(occurrenceId)).toThrow(
      'The occurrence id should match the format "indexedoccurrence_{trainScheduleId}_{occurrenceIndex}" or "exception_{trainScheduleId}_{exceptionId}"'
    );
  });

  it("should throw an error if the train schedule id isn't a number", () => {
    const occurrenceId = 'indexedoccurrence_onetwo_3' as OccurrenceId;
    expect(() => extractTrainScheduleIdFromOccurrenceId(occurrenceId)).toThrow(
      `Invalid train schedule ID : ${occurrenceId}`
    );
  });
});

describe('extractOccurrenceIndexFromOccurrenceId', () => {
  it('should return the occurrence index', () => {
    const occurrenceId = 'indexedoccurrence_123_1' as OccurrenceId;
    const result = extractOccurrenceIndexFromOccurrenceId(occurrenceId);
    expect(result).toBe(1);
  });

  it('should throw an error for an invalid key format', () => {
    const occurrenceId = 'exception_123_1' as OccurrenceId;
    expect(() => extractOccurrenceIndexFromOccurrenceId(occurrenceId)).toThrow(
      'The occurrence id should match the format "indexedoccurrence_{trainScheduleId}_{occurrenceIndex}"'
    );
  });

  it("should throw an error if the occurrence index isn't a number", () => {
    const occurrenceId = 'indexedoccurrence_123_three' as OccurrenceId;
    expect(() => extractOccurrenceIndexFromOccurrenceId(occurrenceId)).toThrow(
      `Invalid occurrence index: ${occurrenceId}`
    );
  });
});

describe('extractExceptionIdFromOccurrenceId', () => {
  it('should return the exception id', () => {
    const occurrenceId = 'exception_123_1' as OccurrenceId;
    const result = extractExceptionIdFromOccurrenceId(occurrenceId);
    expect(result).toBe(1);
  });

  it('should throw an error for an invalid key format', () => {
    const occurrenceId = 'indexedoccurrence_123_1' as OccurrenceId;
    expect(() => extractExceptionIdFromOccurrenceId(occurrenceId)).toThrow(
      'The occurrence id should match the format "exception_{trainScheduleId}_{exceptionId}"'
    );
  });

  it("should throw an error if the exception id isn't a number", () => {
    const occurrenceId = 'exception_123_exceptionId' as OccurrenceId;
    expect(() => extractExceptionIdFromOccurrenceId(occurrenceId)).toThrow(
      `Exception ID should be a number: ${occurrenceId}`
    );
  });
});

describe('isTrainIdInTimetable', () => {
  const trainScheduleEditoastId = 123;
  const uniqueTrainTrainScheduleEditoastId = 456;
  const missingTrainScheduleEditoastId = 999;
  const trainScheduleId = formatEditoastIdToTrainScheduleId(trainScheduleEditoastId);
  const uniqueTrainTrainScheduleId = formatEditoastIdToTrainScheduleId(
    uniqueTrainTrainScheduleEditoastId
  );
  const missingTrainScheduleId = formatEditoastIdToTrainScheduleId(missingTrainScheduleEditoastId);

  const trainSchedules = [
    {
      id: trainScheduleEditoastId,
      paced: {
        timeWindow: Duration.parse('PT2H'),
        interval: Duration.parse('PT30M'),
        exceptions: [
          // TODO_EXCEPTION: delete `key`
          { key: '0', id: 0 },
          { key: '1', id: 1, occurrence_index: 1, disabled: true },
          { key: '2', id: 2, occurrence_index: 2, disabled: false },
        ],
      },
    },
    {
      id: uniqueTrainTrainScheduleEditoastId,
      paced: undefined,
    },
  ];

  it('should return false if trainId is undefined', () => {
    expect(isTrainIdInTimetable(undefined, trainSchedules)).toEqual(false);
  });

  it('should return true if train schedule id is present in timetable', () => {
    expect(isTrainIdInTimetable(trainScheduleId, trainSchedules)).toEqual(true); // paced
    expect(isTrainIdInTimetable(uniqueTrainTrainScheduleId, trainSchedules)).toEqual(true); // not paced
  });

  it('should return false if train schedule id is not present in timetable', () => {
    expect(isTrainIdInTimetable(missingTrainScheduleId, trainSchedules)).toEqual(false);
  });

  it('should return true if indexed occurrence id is present in timetable', () => {
    expect(
      isTrainIdInTimetable(
        formatTrainScheduleIdToIndexedOccurrenceId(trainScheduleId, 0),
        trainSchedules
      ) // regular occurrence
    ).toEqual(true);
    expect(
      isTrainIdInTimetable(
        formatTrainScheduleIdToIndexedOccurrenceId(trainScheduleId, 2),
        trainSchedules
      ) // modified exception
    ).toEqual(true);
  });

  it('should return false if occurrence id is not present in timetable as its train schedule is not present', () => {
    expect(
      isTrainIdInTimetable(
        formatTrainScheduleIdToIndexedOccurrenceId(missingTrainScheduleId, 0),
        trainSchedules
      )
    ).toEqual(false);
  });

  it('should return false if occurrence id is not present in timetable as its base train is not paced', () => {
    expect(
      isTrainIdInTimetable(
        formatTrainScheduleIdToIndexedOccurrenceId(uniqueTrainTrainScheduleId, 0),
        trainSchedules
      )
    ).toEqual(false);
  });

  it('should return false if indexed occurrence id is not present in timetable as its index is out of bounds', () => {
    expect(
      isTrainIdInTimetable(
        formatTrainScheduleIdToIndexedOccurrenceId(trainScheduleId, -1),
        trainSchedules
      )
    ).toEqual(false);
    expect(
      isTrainIdInTimetable(
        formatTrainScheduleIdToIndexedOccurrenceId(trainScheduleId, 4),
        trainSchedules
      )
    ).toEqual(false);
  });

  it('should return false if indexed occurrence id is not present in timetable as it is disabled', () => {
    expect(
      isTrainIdInTimetable(
        formatTrainScheduleIdToIndexedOccurrenceId(trainScheduleId, 1),
        trainSchedules
      )
    ).toEqual(false);
  });

  it('should return true if added exception id is present in timetable', () => {
    expect(
      isTrainIdInTimetable(formatTrainScheduleIdToExceptionId(trainScheduleId, 0), trainSchedules)
    ).toEqual(true);
  });

  it('should return false if added exception id is not present in timetable', () => {
    expect(
      isTrainIdInTimetable(formatTrainScheduleIdToExceptionId(trainScheduleId, 999), trainSchedules)
    ).toEqual(false);
  });
});
