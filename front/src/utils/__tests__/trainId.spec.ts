import { describe, it, expect } from 'vitest';

import type { TrainScheduleId, OccurrenceId, PacedTrainId } from 'reducers/osrdconf/types';

import {
  formatEditoastIdToTrainScheduleId,
  formatEditoastIdToIndexedOccurrenceId,
  formatPacedTrainIdToOccurrenceId,
  formatTrainScheduleIdToEditoastTrainId,
  formatOccurrenceIdToEditoastTrainId,
  formatEditoastIdToPacedTrainId,
  formatPacedTrainIdToEditoastTrainId,
  getOccurrenceIndexFromOccurrenceId,
  extractPacedTrainIdFromOccurrenceId,
  formatEditoastIdToExceptionId,
  getExceptionIdFromOccurrenceId,
  extractPacedTrainIdFromOccurenceId,
} from '../trainId';

describe('formatEditoastIdToTrainScheduleId', () => {
  it('should format to a TrainScheduleId', () => {
    const trainId = 123;
    const result = formatEditoastIdToTrainScheduleId(trainId);
    expect(result).toEqual(`trainschedule_${trainId}`);
  });
});

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
    const exceptionId = 'exception-uuid';
    const result = formatEditoastIdToExceptionId({ pacedTrainId, exceptionId });
    expect(result).toBe(`exception_${pacedTrainId}_${exceptionId}`);
  });
});

describe('formatTrainScheduleIdToEditoastTrainId', () => {
  it('should return a valid editoast id', () => {
    const trainScheduleId = 'trainschedule_123' as TrainScheduleId;
    const result = formatTrainScheduleIdToEditoastTrainId(trainScheduleId);
    expect(result).toBe(123);
  });

  it("should throw an error if the trainScheduleId doesn't start correctly", () => {
    const trainScheduleId = 'invalid_123' as TrainScheduleId;
    expect(() => formatTrainScheduleIdToEditoastTrainId(trainScheduleId)).toThrow(
      'The train schedule id should start with "trainschedule_"'
    );
  });

  it("should throw an error if the return train id isn't a number", () => {
    const trainScheduleId = 'trainschedule_onetwo' as TrainScheduleId;
    expect(() => formatTrainScheduleIdToEditoastTrainId(trainScheduleId)).toThrow(
      `Invalid train ID: ${trainScheduleId}`
    );
  });
});

describe('formatPacedTrainIdToEditoastTrainId', () => {
  it('should return a valid editoast id', () => {
    const pacedTrainId = 'paced_123' as PacedTrainId;
    const result = formatPacedTrainIdToEditoastTrainId(pacedTrainId);
    expect(result).toBe(123);
  });

  it("should throw an error if the pacedTrainId doesn't start correctly", () => {
    const pacedTrainId = 'invalid_123' as PacedTrainId;
    expect(() => formatPacedTrainIdToEditoastTrainId(pacedTrainId)).toThrow(
      'The paced train id should start with "paced_"'
    );
  });

  it("should throw an error if the return train id isn't a number", () => {
    const pacedTrainId = 'paced_onetwo' as PacedTrainId;
    expect(() => formatPacedTrainIdToEditoastTrainId(pacedTrainId)).toThrow(
      `Invalid paced train ID: ${pacedTrainId}`
    );
  });
});

describe('formatOccurrenceIdToEditoastTrainId', () => {
  it('should return a valid editoast id for a regular occurrence', () => {
    const occurrenceId = 'indexedoccurrence_123_1' as OccurrenceId;
    const result = formatOccurrenceIdToEditoastTrainId(occurrenceId);
    expect(result).toBe(123);
  });

  it('should return a valid editoast id for an added exception', () => {
    const occurrenceId = 'exception_123_1' as OccurrenceId;
    const result = formatOccurrenceIdToEditoastTrainId(occurrenceId);
    expect(result).toBe(123);
  });

  it('should throw an error for an invalid occurrence key format', () => {
    const occurrenceId = 'train_123_1' as OccurrenceId;
    expect(() => formatOccurrenceIdToEditoastTrainId(occurrenceId)).toThrow(
      'The occurrence id should match the format "indexedoccurrence_{pacedTrainId}_{occurrenceIndex}" or "exception_{pacedTrainId}_{exceptionId}"'
    );
  });

  it("should throw an error if the paced train id isn't a number", () => {
    const occurrenceId = 'indexedoccurrence_onetwo_3' as OccurrenceId;
    expect(() => formatOccurrenceIdToEditoastTrainId(occurrenceId)).toThrow(
      `Invalid paced train ID : ${occurrenceId}`
    );
  });
});

describe('formatPacedTrainIdToOccurrenceId', () => {
  it('should return the occurrenceId', () => {
    const pacedTrainId = 'paced_123' as PacedTrainId;
    const result = formatPacedTrainIdToOccurrenceId(pacedTrainId, 0);
    expect(result).toBe('indexedoccurrence_123_0');
  });

  it('should throw if pacedTrainId is invalid', () => {
    const pacedTrainId = 'invalid_paced_123' as PacedTrainId;
    expect(() => formatPacedTrainIdToOccurrenceId(pacedTrainId, 0)).toThrow(
      'The paced train id should start with "paced_"'
    );
  });
});

describe('extractPacedTrainIdFromOccurrenceId', () => {
  it('should return the pacedTrainId for a regular occurrence', () => {
    const occurenceId = 'indexedoccurrence_123_0' as OccurrenceId;
    const result = extractPacedTrainIdFromOccurrenceId(occurenceId);
    expect(result).toBe('paced_123');
  });

  it('should return the pacedTrainId for an added exception', () => {
    const occurenceId = 'exception_123_0' as OccurrenceId;
    const result = extractPacedTrainIdFromOccurrenceId(occurenceId);
    expect(result).toBe('paced_123');
  });

  it('should throw if the key is invalid', () => {
    const occurenceId = 'exception-indexedoccurrence_123_0' as OccurrenceId;
    expect(() => extractPacedTrainIdFromOccurrenceId(occurenceId)).toThrow(
      'The occurrence id should match the format "indexedoccurrence_{pacedTrainId}_{occurrenceIndex}" or "exception_{pacedTrainId}_{exceptionId}"'
    );
  });
});

describe('getOccurrenceIndexFromOccurrenceId', () => {
  it('should return the occurrence index', () => {
    const occurrenceId = 'indexedoccurrence_123_1' as OccurrenceId;
    const result = getOccurrenceIndexFromOccurrenceId(occurrenceId);
    expect(result).toBe(1);
  });

  it('should throw an error for an invalid key format', () => {
    const occurrenceId = 'exception_123_1' as OccurrenceId;
    expect(() => getOccurrenceIndexFromOccurrenceId(occurrenceId)).toThrow(
      'The occurrence id should match the format "indexedoccurrence_{pacedTrainId}_{occurrenceIndex}"'
    );
  });

  it("should throw an error if the occurrence index isn't a number", () => {
    const occurrenceId = 'indexedoccurrence_123_three' as OccurrenceId;
    expect(() => getOccurrenceIndexFromOccurrenceId(occurrenceId)).toThrow(
      `Invalid occurrence index: ${occurrenceId}`
    );
  });
});

describe('getExceptionIdFromOccurrenceId', () => {
  it('should return the exception id', () => {
    const occurrenceId = 'exception_123_exception-uuid' as OccurrenceId;
    const result = getExceptionIdFromOccurrenceId(occurrenceId);
    expect(result).toBe('exception-uuid');
  });

  it('should return the whole exception id if it contains underscores', () => {
    const occurrenceId = 'exception_123_exception_uuid_with_underscores' as OccurrenceId;
    const result = getExceptionIdFromOccurrenceId(occurrenceId);
    expect(result).toBe('exception_uuid_with_underscores');
  });

  it('should throw an error for an invalid key format', () => {
    const occurrenceId = 'indexedoccurrence_123_exception-uuid' as OccurrenceId;
    expect(() => getExceptionIdFromOccurrenceId(occurrenceId)).toThrow(
      'The occurrence id should match the format "exception_{pacedTrainId}_{exceptionId}"'
    );
  });
});

describe('extractPacedTrainIdFromOccurenceId', () => {
  it('should return the paced train ID', () => {
    const occurrenceId = 'indexedoccurrence_123_1' as OccurrenceId;
    const result = extractPacedTrainIdFromOccurenceId(occurrenceId);
    expect(result).toBe('paced_123');
  });
});
