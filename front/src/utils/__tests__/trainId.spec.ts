import { describe, it, expect } from 'vitest';

import type { OccurrenceId, PacedTrainId } from 'reducers/osrdconf/types';
import { Duration } from 'utils/duration';

import {
  formatEditoastIdToIndexedOccurrenceId,
  formatPacedTrainIdToIndexedOccurrenceId,
  formatEditoastIdToPacedTrainId,
  extractEditoastIdFromPacedTrainId,
  extractOccurrenceIndexFromOccurrenceId,
  extractPacedTrainIdFromOccurrenceId,
  formatEditoastIdToExceptionId,
  extractExceptionIdFromOccurrenceId,
  formatPacedTrainIdToExceptionId,
  isTrainIdInTimetable,
} from '../trainId';

describe('formatEditoastIdToPacedTrainId', () => {
  it('should format to a PacedTrainId', () => {
    const trainId = 123;
    const result = formatEditoastIdToPacedTrainId(trainId);
    expect(result).toEqual(`paced_${trainId}`);
  });
});

describe('formatEditoastIdToIndexedOccurrenceId', () => {
  it('should format a valid paced train ID and occurrence index correctly', () => {
    const pacedTrainId = 123;
    const occurrenceIndex = 1;
    const result = formatEditoastIdToIndexedOccurrenceId({ pacedTrainId, occurrenceIndex });
    expect(result).toBe(`indexedoccurrence_${pacedTrainId}_${occurrenceIndex}`);
  });
});

describe('formatEditoastIdToExceptionId', () => {
  it('should format a valid paced train ID and occurrence index correctly', () => {
    const pacedTrainId = 123;
    const exceptionId = 1;
    const result = formatEditoastIdToExceptionId({ pacedTrainId, exceptionId });
    expect(result).toBe(`exception_${pacedTrainId}_${exceptionId}`);
  });
});

describe('extractEditoastIdFromPacedTrainId', () => {
  it('should return a valid editoast id', () => {
    const pacedTrainId = 'paced_123' as PacedTrainId;
    const result = extractEditoastIdFromPacedTrainId(pacedTrainId);
    expect(result).toBe(123);
  });

  it("should throw an error if the pacedTrainId doesn't start correctly", () => {
    const pacedTrainId = 'invalid_123' as PacedTrainId;
    expect(() => extractEditoastIdFromPacedTrainId(pacedTrainId)).toThrow(
      'The paced train id should start with "paced_"'
    );
  });

  it("should throw an error if the return train id isn't a number", () => {
    const pacedTrainId = 'paced_onetwo' as PacedTrainId;
    expect(() => extractEditoastIdFromPacedTrainId(pacedTrainId)).toThrow(
      `Invalid paced train ID: ${pacedTrainId}`
    );
  });
});

describe('formatPacedTrainIdToIndexedOccurrenceId', () => {
  it('should return the occurrenceId', () => {
    const pacedTrainId = 'paced_123' as PacedTrainId;
    const result = formatPacedTrainIdToIndexedOccurrenceId(pacedTrainId, 0);
    expect(result).toBe('indexedoccurrence_123_0');
  });

  it('should throw if pacedTrainId is invalid', () => {
    const pacedTrainId = 'invalid_paced_123' as PacedTrainId;
    expect(() => formatPacedTrainIdToIndexedOccurrenceId(pacedTrainId, 0)).toThrow(
      'The paced train id should start with "paced_"'
    );
  });
});

describe('formatPacedTrainIdToExceptionId', () => {
  it('should return the exceptionId', () => {
    const pacedTrainId = 'paced_123' as PacedTrainId;
    const result = formatPacedTrainIdToExceptionId(pacedTrainId, 1234);
    expect(result).toBe('exception_123_1234');
  });

  it('should throw if pacedTrainId is invalid', () => {
    const pacedTrainId = 'invalid_paced_123' as PacedTrainId;
    expect(() => formatPacedTrainIdToExceptionId(pacedTrainId, 12345)).toThrow(
      'The paced train id should start with "paced_"'
    );
  });
});

describe('extractPacedTrainIdFromOccurrenceId', () => {
  it('should return the pacedTrainId for a regular occurrence', () => {
    const occurrenceId = 'indexedoccurrence_123_0' as OccurrenceId;
    const result = extractPacedTrainIdFromOccurrenceId(occurrenceId);
    expect(result).toBe('paced_123');
  });

  it('should return the pacedTrainId for an added exception', () => {
    const occurrenceId = 'exception_123_0' as OccurrenceId;
    const result = extractPacedTrainIdFromOccurrenceId(occurrenceId);
    expect(result).toBe('paced_123');
  });

  it('should throw if the key is invalid', () => {
    const occurrenceId = 'exception-indexedoccurrence_123_0' as OccurrenceId;
    expect(() => extractPacedTrainIdFromOccurrenceId(occurrenceId)).toThrow(
      'The occurrence id should match the format "indexedoccurrence_{pacedTrainId}_{occurrenceIndex}" or "exception_{pacedTrainId}_{exceptionId}"'
    );
  });

  it("should throw an error if the paced train id isn't a number", () => {
    const occurrenceId = 'indexedoccurrence_onetwo_3' as OccurrenceId;
    expect(() => extractPacedTrainIdFromOccurrenceId(occurrenceId)).toThrow(
      `Invalid paced train ID : ${occurrenceId}`
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
      'The occurrence id should match the format "indexedoccurrence_{pacedTrainId}_{occurrenceIndex}"'
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
      'The occurrence id should match the format "exception_{pacedTrainId}_{exceptionId}"'
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
  const pacedTimetableItemId = 123;
  const notPacedTimetableItemId = 456;
  const missingTimetableItemId = 999;
  const pacedTrainId = formatEditoastIdToPacedTrainId(pacedTimetableItemId);
  const notPacedTrainId = formatEditoastIdToPacedTrainId(notPacedTimetableItemId);
  const missingPacedTrainId = formatEditoastIdToPacedTrainId(missingTimetableItemId);

  const timetableItems = [
    {
      id: pacedTimetableItemId,
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
      id: notPacedTimetableItemId,
      paced: undefined,
    },
  ];

  it('should return false if trainId is undefined', () => {
    expect(isTrainIdInTimetable(undefined, timetableItems)).toEqual(false);
  });

  it('should return true if paced train id is present in timetable', () => {
    expect(isTrainIdInTimetable(pacedTrainId, timetableItems)).toEqual(true); // paced
    expect(isTrainIdInTimetable(notPacedTrainId, timetableItems)).toEqual(true); // not paced
  });

  it('should return false if paced train id is not present in timetable', () => {
    expect(isTrainIdInTimetable(missingPacedTrainId, timetableItems)).toEqual(false);
  });

  it('should return true if indexed occurrence id is present in timetable', () => {
    expect(
      isTrainIdInTimetable(formatPacedTrainIdToIndexedOccurrenceId(pacedTrainId, 0), timetableItems) // regular occurrence
    ).toEqual(true);
    expect(
      isTrainIdInTimetable(formatPacedTrainIdToIndexedOccurrenceId(pacedTrainId, 2), timetableItems) // modified exception
    ).toEqual(true);
  });

  it('should return false if occurrence id is not present in timetable as its paced train is not present', () => {
    expect(
      isTrainIdInTimetable(
        formatPacedTrainIdToIndexedOccurrenceId(missingPacedTrainId, 0),
        timetableItems
      )
    ).toEqual(false);
  });

  it('should return false if occurrence id is not present in timetable as its base train is not paced', () => {
    expect(
      isTrainIdInTimetable(
        formatPacedTrainIdToIndexedOccurrenceId(notPacedTrainId, 0),
        timetableItems
      )
    ).toEqual(false);
  });

  it('should return false if indexed occurrence id is not present in timetable as its index is out of bounds', () => {
    expect(
      isTrainIdInTimetable(
        formatPacedTrainIdToIndexedOccurrenceId(pacedTrainId, -1),
        timetableItems
      )
    ).toEqual(false);
    expect(
      isTrainIdInTimetable(formatPacedTrainIdToIndexedOccurrenceId(pacedTrainId, 4), timetableItems)
    ).toEqual(false);
  });

  it('should return false if indexed occurrence id is not present in timetable as it is disabled', () => {
    expect(
      isTrainIdInTimetable(formatPacedTrainIdToIndexedOccurrenceId(pacedTrainId, 1), timetableItems)
    ).toEqual(false);
  });

  it('should return true if added exception id is present in timetable', () => {
    expect(
      isTrainIdInTimetable(
        formatPacedTrainIdToExceptionId(pacedTrainId, 0),
        timetableItems
      )
    ).toEqual(true);
  });

  it('should return false if added exception id is not present in timetable', () => {
    expect(
      isTrainIdInTimetable(
        formatPacedTrainIdToExceptionId(pacedTrainId, 999),
        timetableItems
      )
    ).toEqual(false);
  });
});
