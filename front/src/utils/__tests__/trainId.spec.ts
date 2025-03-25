import { describe, it, expect } from 'vitest';

import type { TrainScheduleId, OccurrenceId, PacedTrainId } from 'reducers/osrdconf/types';

import {
  formatEditoastTrainIdToTrainScheduleId,
  formatEditoastTrainIdToOccurrenceId,
  formatTrainScheduleIdToEditoastTrainId,
  formatOccurrenceIdToEditoastTrainId,
  formatEditoastTrainIdToPacedTrainId,
  formatPacedTrainIdToEditoastTrainId,
  getOccurrenceIndexFromOccurrenceId,
} from '../trainId';

describe('formatEditoastTrainIdToTrainScheduleId', () => {
  it('should format to a TrainScheduleId', () => {
    const trainId = 123;
    const result = formatEditoastTrainIdToTrainScheduleId(trainId);
    expect(result).toEqual(`trainschedule-${trainId}`);
  });
});

describe('formatEditoastTrainIdToPacedTrainId', () => {
  it('should format to a PacedTrainId', () => {
    const trainId = 123;
    const result = formatEditoastTrainIdToPacedTrainId(trainId);
    expect(result).toEqual(`paced-${trainId}`);
  });
});

describe('formatEditoastTrainIdToOccurrenceId', () => {
  it('should format a valid paced train ID and occurrence index correctly', () => {
    const pacedTrainId = 123;
    const occurrenceIndex = 1;
    const result = formatEditoastTrainIdToOccurrenceId({ pacedTrainId, occurrenceIndex });
    expect(result).toBe(`occurrence-${occurrenceIndex}-paced-${pacedTrainId}`);
  });
});

describe('formatTrainScheduleIdToEditoastTrainId', () => {
  it('should return a valid editoast id', () => {
    const trainScheduleId = 'trainschedule-123' as TrainScheduleId;
    const result = formatTrainScheduleIdToEditoastTrainId(trainScheduleId);
    expect(result).toBe(123);
  });

  it("should throw an error if the trainScheduleId doesn't start correctly", () => {
    const trainScheduleId = 'invalid-123' as TrainScheduleId;
    expect(() => formatTrainScheduleIdToEditoastTrainId(trainScheduleId)).toThrow(
      'The train schedule id should start with "trainschedule-"'
    );
  });

  it("should throw an error if the return train id isn't a number", () => {
    const trainScheduleId = 'trainschedule-onetwo' as TrainScheduleId;
    expect(() => formatTrainScheduleIdToEditoastTrainId(trainScheduleId)).toThrow(
      `Invalid train ID: ${trainScheduleId}`
    );
  });
});

describe('formatPacedTrainIdToEditoastTrainId', () => {
  it('should return a valid editoast id', () => {
    const pacedTrainId = 'paced-123' as PacedTrainId;
    const result = formatPacedTrainIdToEditoastTrainId(pacedTrainId);
    expect(result).toBe(123);
  });

  it("should throw an error if the pacedTrainId doesn't start correctly", () => {
    const pacedTrainId = 'invalid-123' as PacedTrainId;
    expect(() => formatPacedTrainIdToEditoastTrainId(pacedTrainId)).toThrow(
      'The paced train id should start with "paced-"'
    );
  });

  it("should throw an error if the return train id isn't a number", () => {
    const pacedTrainId = 'paced-onetwo' as PacedTrainId;
    expect(() => formatPacedTrainIdToEditoastTrainId(pacedTrainId)).toThrow(
      `Invalid paced train ID: ${pacedTrainId}`
    );
  });
});

describe('formatOccurrenceIdToEditoastTrainId', () => {
  it('should return a valid editoast id', () => {
    const occurrenceId = 'occurrence-1-paced-123' as OccurrenceId;
    const result = formatOccurrenceIdToEditoastTrainId(occurrenceId);
    expect(result).toBe(123);
  });

  it('should throw an error for an invalid pacedTrain key format', () => {
    const occurrenceId = 'occurrence-1-invalid-123' as OccurrenceId;
    expect(() => formatOccurrenceIdToEditoastTrainId(occurrenceId)).toThrow(
      'The occurrence id should match the format "occurrence-{occurrenceIndex}-paced-{trainId}"'
    );
  });

  it('should throw an error for an invalid occurrence key format', () => {
    const occurrenceId = 'train-1-paced-123' as OccurrenceId;
    expect(() => formatOccurrenceIdToEditoastTrainId(occurrenceId)).toThrow(
      'The occurrence id should match the format "occurrence-{occurrenceIndex}-paced-{trainId}"'
    );
  });

  it("should throw an error if the paced train id isn't a number", () => {
    const occurrenceId = 'occurrence-3-paced-onetwo' as OccurrenceId;
    expect(() => formatOccurrenceIdToEditoastTrainId(occurrenceId)).toThrow(
      `Invalid paced train ID or occurrence index: ${occurrenceId}`
    );
  });

  it("should throw an error if the occurrence id isn't a number", () => {
    const occurrenceId = 'occurrence-five-paced-2' as OccurrenceId;
    expect(() => formatOccurrenceIdToEditoastTrainId(occurrenceId)).toThrow(
      `Invalid paced train ID or occurrence index: ${occurrenceId}`
    );
  });
});

describe('getOccurrenceIndexFromOccurrenceId', () => {
  it('should return the occurrence index', () => {
    const occurrenceId = 'occurrence-1-paced-123' as OccurrenceId;
    const result = getOccurrenceIndexFromOccurrenceId(occurrenceId);
    expect(result).toBe(1);
  });

  it('should throw an error for an invalid pacedTrain key format', () => {
    const occurrenceId = 'occurrence-1-invalid-123' as OccurrenceId;
    expect(() => formatOccurrenceIdToEditoastTrainId(occurrenceId)).toThrow(
      'The occurrence id should match the format "occurrence-{occurrenceIndex}-paced-{trainId}"'
    );
  });

  it('should throw an error for an invalid occurrence key format', () => {
    const occurrenceId = 'train-1-paced-123' as OccurrenceId;
    expect(() => formatOccurrenceIdToEditoastTrainId(occurrenceId)).toThrow(
      'The occurrence id should match the format "occurrence-{occurrenceIndex}-paced-{trainId}"'
    );
  });

  it("should throw an error if the paced train id isn't a number", () => {
    const occurrenceId = 'occurrence-3-paced-onetwo' as OccurrenceId;
    expect(() => formatOccurrenceIdToEditoastTrainId(occurrenceId)).toThrow(
      `Invalid paced train ID or occurrence index: ${occurrenceId}`
    );
  });

  it("should throw an error if the occurrence id isn't a number", () => {
    const occurrenceId = 'occurrence-five-paced-2' as OccurrenceId;
    expect(() => formatOccurrenceIdToEditoastTrainId(occurrenceId)).toThrow(
      `Invalid paced train ID or occurrence index: ${occurrenceId}`
    );
  });
});
