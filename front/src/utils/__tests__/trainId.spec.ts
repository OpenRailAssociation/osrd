import { describe, it, expect } from 'vitest';

import type { TrainScheduleId, OccurrenceId, PacedTrainId } from 'reducers/osrdconf/types';

import {
  formatEditoastTrainIdToTrainScheduleId,
  formatEditoastTrainIdToOccurrenceId,
  formatTrainScheduleIdToEditoastTrainId,
  formatOccurrenceIdToEditoastTrainId,
  formatEditoastTrainIdToPacedTrainId,
  formatPacedTrainIdToEditoastTrainId,
} from '../trainId';

describe('formatEditoastTrainIdToTrainScheduleId', () => {
  it('should format to a TrainScheduleId', () => {
    const trainId = 123;
    const result = formatEditoastTrainIdToTrainScheduleId(trainId);
    expect(result).toEqual(`train-${trainId}`);
  });
});

describe('formatEditoastTrainIdToPacedTrainId', () => {
  it('should format to a TrainScheduleId', () => {
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
    expect(result).toBe(`paced-${pacedTrainId}-occurrence-${occurrenceIndex}`);
  });
});

describe('formatTrainScheduleIdToEditoastTrainId', () => {
  it('should return a valid editoast id', () => {
    const trainScheduleId: TrainScheduleId = 'train-123' as TrainScheduleId;
    const result = formatTrainScheduleIdToEditoastTrainId(trainScheduleId);
    expect(result).toBe(123);
  });

  it("should throw an error if the trainScheduleId doesn't start correctly", () => {
    const trainScheduleId: TrainScheduleId = 'invalid-123' as TrainScheduleId;
    expect(() => formatTrainScheduleIdToEditoastTrainId(trainScheduleId)).toThrow(
      'The train schedule id should start with "train-"'
    );
  });

  it("should throw an error if the return train id isn't a number", () => {
    const trainScheduleId: TrainScheduleId = 'train-onetwo' as TrainScheduleId;
    expect(() => formatTrainScheduleIdToEditoastTrainId(trainScheduleId)).toThrow(
      `Invalid train ID: ${trainScheduleId}`
    );
  });
});

describe('formatPacedTrainIdToEditoastTrainId', () => {
  it('should return a valid editoast id', () => {
    const pacedTrainId: PacedTrainId = 'paced-123' as PacedTrainId;
    const result = formatPacedTrainIdToEditoastTrainId(pacedTrainId);
    expect(result).toBe(123);
  });

  it("should throw an error if the pacedTrainId doesn't start correctly", () => {
    const pacedTrainId: PacedTrainId = 'invalid-123' as PacedTrainId;
    expect(() => formatPacedTrainIdToEditoastTrainId(pacedTrainId)).toThrow(
      'The paced train id should start with "paced-"'
    );
  });

  it("should throw an error if the return train id isn't a number", () => {
    const pacedTrainId: PacedTrainId = 'paced-onetwo' as PacedTrainId;
    expect(() => formatPacedTrainIdToEditoastTrainId(pacedTrainId)).toThrow(
      `Invalid paced train ID: ${pacedTrainId}`
    );
  });
});

describe('formatOccurrenceIdToEditoastTrainId', () => {
  it('should return a valid editoast id', () => {
    const occurrenceId: OccurrenceId = 'paced-123-occurrence-1' as OccurrenceId;
    const result = formatOccurrenceIdToEditoastTrainId(occurrenceId);
    expect(result).toBe(123);
  });

  it('should throw an error for an invalid pacedTrain key format', () => {
    const occurrenceId: OccurrenceId = 'invalid-123-occurrence-1' as OccurrenceId;
    expect(() => formatOccurrenceIdToEditoastTrainId(occurrenceId)).toThrow(
      'The occurrence id should match the format "paced-{trainId}-occurrence-{occurrenceIndex}"'
    );
  });

  it('should throw an error for an invalid occurrence key format', () => {
    const occurrenceId: OccurrenceId = 'paced-123-train-1' as OccurrenceId;
    expect(() => formatOccurrenceIdToEditoastTrainId(occurrenceId)).toThrow(
      'The occurrence id should match the format "paced-{trainId}-occurrence-{occurrenceIndex}"'
    );
  });

  it("should throw an error if the paced train id isn't a number", () => {
    const occurrenceId: OccurrenceId = 'paced-onetwo-occurrence-3' as OccurrenceId;
    expect(() => formatOccurrenceIdToEditoastTrainId(occurrenceId)).toThrow(
      `Invalid paced train ID or occurrence ID: ${occurrenceId}`
    );
  });

  it("should throw an error if the occurrence id isn't a number", () => {
    const occurrenceId: OccurrenceId = 'paced-2-occurrence-five' as OccurrenceId;
    expect(() => formatOccurrenceIdToEditoastTrainId(occurrenceId)).toThrow(
      `Invalid paced train ID or occurrence ID: ${occurrenceId}`
    );
  });
});
