import { describe, it, expect } from 'vitest';

import type { TrainSchedule, TrainScheduleExceptionChangeGroups } from 'common/api/osrdEditoastApi';
import type {
  PacedTrainWithPacedWithDetails,
  SimulatedException,
  SimulationSummary,
} from 'modules/trainSchedule/types';
import type { PacedTrainId } from 'reducers/osrdconf/types';
import { Duration } from 'utils/duration';
import {
  formatEditoastIdToPacedTrainId,
  formatPacedTrainIdToExceptionId,
  formatPacedTrainIdToIndexedOccurrenceId,
} from 'utils/trainId';

import {
  extractOccurrenceDetailsFromPacedTrain,
  getFirstActiveOccurrenceId,
  getOccurrencesNb,
  getOccurrencesWorstStatus,
  isOccurrencePresentInPacedTrain,
} from '../pacedTrain';

describe('getOccurrencesNb', () => {
  it('should properly compute occurrence nb for time window of 2h and interval of 30min', () => {
    expect(
      getOccurrencesNb({ timeWindow: Duration.parse('PT2H'), interval: Duration.parse('PT30M') })
    ).toEqual(4);
  });

  it('should properly compute occurrence nb for time window of 30min and interval of 20min', () => {
    expect(
      getOccurrencesNb({ timeWindow: Duration.parse('PT30M'), interval: Duration.parse('PT20M') })
    ).toEqual(2);
  });

  it('should properly compute occurrence nb for time window of 20min and interval of 30min', () => {
    expect(
      getOccurrencesNb({ timeWindow: Duration.parse('PT20M'), interval: Duration.parse('PT30M') })
    ).toEqual(1);
  });

  it('should properly compute occurrence nb for time window of 0h and interval of 30min', () => {
    expect(
      getOccurrencesNb({ timeWindow: Duration.parse('PT0S'), interval: Duration.parse('PT30M') })
    ).toEqual(0);
  });

  it('should properly compute occurrence nb for time window of 2h and interval of 0min', () => {
    expect(() =>
      getOccurrencesNb({ timeWindow: Duration.parse('PT2H'), interval: Duration.parse('PT0S') })
    ).toThrow('Interval cannot be 0');
  });
});

describe('extractOccurrenceDetailsFromPacedTrain', () => {
  const pacedTrain: Omit<TrainSchedule, 'paced' | 'exceptions'> = {
    train_name: '8608',
    labels: ['Paced-Train-Tag-1', 'SS-NS', 'Valid'],
    rolling_stock_name: '',
    start_time: new Date('2024-10-15T03:00:00Z').getTime(),
    path: [
      {
        id: 'id227',
        location: {
          type: 'operational_point_part_reference',
          operational_point: { uic: 6, secondary_code: 'BV', type: 'uic' },
        },
      },
      {
        id: 'id228',
        location: {
          type: 'operational_point_part_reference',
          operational_point: { uic: 5, secondary_code: 'BV', type: 'uic' },
        },
      },
    ],
    schedule: [
      {
        at: 'id228',
        arrival: null,
        stop_for: 'P0D',
        reception_signal: 'OPEN',
      },
    ],
    margins: { boundaries: [], values: ['0%'] },
    options: {
      use_electrical_profiles: false,
    },
    comfort: 'STANDARD',
    constraint_distribution: 'MARECO',
    speed_limit_tag: 'MA100',
  };

  it('should properly update a standard property', () => {
    const changeGroups: TrainScheduleExceptionChangeGroups = {
      train_name: { value: '8608 updated' },
    };
    const updatedPacedTrain = extractOccurrenceDetailsFromPacedTrain(pacedTrain, changeGroups);
    expect(updatedPacedTrain).toEqual({
      ...pacedTrain,
      train_name: '8608 updated',
    });
  });

  it('should properly update speed limit tag with a null value', () => {
    const changeGroups: TrainScheduleExceptionChangeGroups = {
      speed_limit_tag: { value: null },
    };
    const updatedPacedTrain = extractOccurrenceDetailsFromPacedTrain(pacedTrain, changeGroups);
    expect(updatedPacedTrain).toEqual({
      ...pacedTrain,
      speed_limit_tag: null,
    });
  });

  it('should properly update a property containing multiple ones', () => {
    const changeGroups: TrainScheduleExceptionChangeGroups = {
      options: { value: { use_electrical_profiles: true } },
    };
    const updatedPacedTrain = extractOccurrenceDetailsFromPacedTrain(pacedTrain, changeGroups);
    expect(updatedPacedTrain).toEqual({
      ...pacedTrain,
      options: {
        use_electrical_profiles: true,
      },
    });
  });

  it('should properly update path and schedule change group', () => {
    const changeGroups: TrainScheduleExceptionChangeGroups = {
      path_and_schedule: {
        path: [
          {
            id: 'id225',
            location: {
              type: 'operational_point_part_reference',
              operational_point: { uic: 6, secondary_code: 'BV', type: 'uic' },
            },
          },
          {
            id: 'id228',
            location: {
              type: 'operational_point_part_reference',
              operational_point: { uic: 5, secondary_code: 'BV', type: 'uic' },
            },
          },
        ],
        schedule: [
          {
            at: 'id228',
            arrival: null,
            stop_for: 'P0D',
            reception_signal: 'OPEN',
          },
        ],
        margins: { boundaries: [], values: ['0%'] },
        power_restrictions: [],
      },
    };
    const updatedPacedTrain = extractOccurrenceDetailsFromPacedTrain(pacedTrain, changeGroups);
    expect(updatedPacedTrain).toEqual({
      ...pacedTrain,
      path: changeGroups.path_and_schedule!.path,
      margins: changeGroups.path_and_schedule!.margins,
      power_restrictions: changeGroups.path_and_schedule!.power_restrictions,
      schedule: changeGroups.path_and_schedule!.schedule,
    });
  });
});

describe('getOccurrencesWorstStatus', () => {
  const invalidSummary = { isValid: false } as SimulationSummary;
  const validSummary = { isValid: true } as SimulationSummary;
  const validLateSummary = {
    isValid: true,
    notHonoredReason: 'scheduleNotHonored',
  } as SimulationSummary;
  const validTooFastSummary = {
    isValid: true,
    notHonoredReason: 'trainTooFast',
  } as SimulationSummary;

  describe('should return invalid', () => {
    it('should return invalid if the train model is invalid', () => {
      expect(
        getOccurrencesWorstStatus(invalidSummary, [
          { summary: validSummary } as SimulatedException,
          { summary: validLateSummary } as SimulatedException,
          { summary: validTooFastSummary } as SimulatedException,
        ])
      ).toEqual('invalid');
    });

    it('should return invalid if the train model is invalid and some occurrences are late', () => {
      expect(
        getOccurrencesWorstStatus(invalidSummary, [
          { summary: validSummary } as SimulatedException,
          { summary: validLateSummary } as SimulatedException,
          { summary: validTooFastSummary } as SimulatedException,
        ])
      ).toEqual('invalid');
    });

    it('should return invalid if the train model is late but an occurrence is invalid', () => {
      expect(
        getOccurrencesWorstStatus(validLateSummary, [
          { summary: validSummary } as SimulatedException,
          { summary: invalidSummary } as SimulatedException,
          { summary: validTooFastSummary } as SimulatedException,
        ])
      ).toEqual('invalid');
    });

    it('should return invalid if the train model is too fast but an occurrence is invalid', () => {
      expect(
        getOccurrencesWorstStatus(validTooFastSummary, [
          { summary: validSummary } as SimulatedException,
          { summary: invalidSummary } as SimulatedException,
          { summary: validTooFastSummary } as SimulatedException,
        ])
      ).toEqual('invalid');
    });

    it('should return invalid if the train model is valid and on time but an occurrence is invalid', () => {
      expect(
        getOccurrencesWorstStatus(validSummary, [
          { summary: validSummary } as SimulatedException,
          { summary: invalidSummary } as SimulatedException,
          { summary: validTooFastSummary } as SimulatedException,
        ])
      ).toEqual('invalid');
    });
  });

  describe('should return late', () => {
    it('should return late if the train model and some occurrences are late', () => {
      expect(
        getOccurrencesWorstStatus(validLateSummary, [
          { summary: validSummary } as SimulatedException,
          { summary: validLateSummary } as SimulatedException,
          { summary: validTooFastSummary } as SimulatedException,
        ])
      ).toEqual('scheduleNotHonored');
    });

    it('should return late if the train model is too fast but an occurrence is late', () => {
      expect(
        getOccurrencesWorstStatus(validTooFastSummary, [
          { summary: validSummary } as SimulatedException,
          { summary: validLateSummary } as SimulatedException,
          { summary: validTooFastSummary } as SimulatedException,
        ])
      ).toEqual('scheduleNotHonored');
    });

    it('should return late if the train model is late and an occurrence is invalid but disabled', () => {
      expect(
        getOccurrencesWorstStatus(validLateSummary, [
          { summary: validSummary } as SimulatedException,
          { summary: invalidSummary, disabled: true } as SimulatedException,
        ])
      ).toEqual('scheduleNotHonored');
    });

    it('should return late if the train model is valid and on time but an occurrence is late', () => {
      expect(
        getOccurrencesWorstStatus(validSummary, [
          { summary: validSummary } as SimulatedException,
          { summary: validLateSummary } as SimulatedException,
          { summary: validTooFastSummary } as SimulatedException,
        ])
      ).toEqual('scheduleNotHonored');
    });
  });

  describe('should return too fast', () => {
    it('should return too fast if the train model is too fast and the occurrences are valid and on time', () => {
      expect(
        getOccurrencesWorstStatus(validTooFastSummary, [
          { summary: validSummary } as SimulatedException,
          { summary: validSummary } as SimulatedException,
        ])
      ).toEqual('trainTooFast');
    });

    it('should return too fast if the train model is valid and on time and one of the occurrences is too fast', () => {
      expect(
        getOccurrencesWorstStatus(validSummary, [
          { summary: validSummary } as SimulatedException,
          { summary: validTooFastSummary } as SimulatedException,
        ])
      ).toEqual('trainTooFast');
    });

    it('should return too fast if the train model is too fast and an occurrence is invalid or late but disabled', () => {
      expect(
        getOccurrencesWorstStatus(validTooFastSummary, [
          { summary: validSummary } as SimulatedException,
          { summary: validTooFastSummary, disabled: true } as SimulatedException,
          { summary: invalidSummary, disabled: true } as SimulatedException,
        ])
      ).toEqual('trainTooFast');
    });
  });

  describe('should return nothing', () => {
    it('should return nothing if the train model and all the occurrences are valid and on time', () => {
      expect(
        getOccurrencesWorstStatus(validSummary, [
          { summary: validSummary } as SimulatedException,
          { summary: validSummary } as SimulatedException,
        ])
      ).toEqual('');
    });

    it('should return nothing if some occurrences are invalid, late or too fast but disabled', () => {
      expect(
        getOccurrencesWorstStatus(validSummary, [
          { summary: validSummary } as SimulatedException,
          { summary: invalidSummary, disabled: true } as SimulatedException,
          { summary: validLateSummary, disabled: true } as SimulatedException,
          { summary: validTooFastSummary, disabled: true } as SimulatedException,
        ])
      ).toEqual('');
    });
  });
});

describe('isOccurrencePresentInPacedTrain', () => {
  const trainScheduleId = 123;
  const pacedTrainId = formatEditoastIdToPacedTrainId(trainScheduleId);

  const paced = {
    timeWindow: Duration.parse('PT2H'),
    interval: Duration.parse('PT30M'),
    exceptions: [
      {
        id: 1,
        occurrence_index: 1,
        disabled: true,
        change_groups: {},
        timetable_id: trainScheduleId,
        train_schedule_id: trainScheduleId,
      },
    ],
  };
  const trainSchedule = { paced, id: trainScheduleId };

  it('should return false if the train schedule is not paced', () => {
    expect(
      isOccurrencePresentInPacedTrain(formatPacedTrainIdToIndexedOccurrenceId(pacedTrainId, 0), {
        paced: undefined,
        id: trainScheduleId,
      })
    ).toEqual(false);
  });

  it('should return false if the occurrence does not belong to the paced train id', () => {
    expect(
      isOccurrencePresentInPacedTrain(
        formatPacedTrainIdToIndexedOccurrenceId(formatEditoastIdToPacedTrainId(999), 0),
        trainSchedule
      )
    ).toEqual(false);
  });

  it('should return true if the indexed occurrence is in range and not disabled', () => {
    expect(
      isOccurrencePresentInPacedTrain(
        formatPacedTrainIdToIndexedOccurrenceId(pacedTrainId, 0), // regular occurrence
        trainSchedule
      )
    ).toEqual(true);
    expect(
      isOccurrencePresentInPacedTrain(
        formatPacedTrainIdToIndexedOccurrenceId(pacedTrainId, 2), // modified exception
        trainSchedule
      )
    ).toEqual(true);
  });

  it('should return false if the indexed occurrence is out of range', () => {
    expect(
      isOccurrencePresentInPacedTrain(
        formatPacedTrainIdToIndexedOccurrenceId(pacedTrainId, -1),
        trainSchedule
      )
    ).toEqual(false);
    expect(
      isOccurrencePresentInPacedTrain(
        formatPacedTrainIdToIndexedOccurrenceId(pacedTrainId, 4),
        trainSchedule
      )
    ).toEqual(false);
  });

  it('should return false if the indexed occurrence is a disabled exception', () => {
    expect(
      isOccurrencePresentInPacedTrain(
        formatPacedTrainIdToIndexedOccurrenceId(pacedTrainId, 1),
        trainSchedule
      )
    ).toEqual(false);
  });

  it('should return true if the occurrence is an added exception present in the paced train', () => {
    expect(
      isOccurrencePresentInPacedTrain(
        formatPacedTrainIdToExceptionId(pacedTrainId, 1),
        trainSchedule
      )
    ).toEqual(true);
  });

  it('should return false if the occurrence is an added exception not present in the paced train', () => {
    expect(
      isOccurrencePresentInPacedTrain(
        formatPacedTrainIdToExceptionId(pacedTrainId, 999),
        trainSchedule
      )
    ).toEqual(false);
  });
});

describe('getFirstActiveOccurrenceId', () => {
  const PACED_ID = 'paced_1' as PacedTrainId;
  const PACED_START_MS = new Date('2026-01-01T08:00:00Z').getTime();
  const INTERVAL_MS = 10 * 60 * 1000;

  const exception = (
    partial: Partial<Record<keyof SimulatedException, unknown>>
  ): SimulatedException => partial as SimulatedException;

  const schedule = (exceptions: SimulatedException[] = []) =>
    ({
      startTime: new Date(PACED_START_MS),
      paced: {
        timeWindow: new Duration({ hours: 1 }),
        interval: new Duration({ minutes: 10 }),
        exceptions,
      },
    }) as unknown as PacedTrainWithPacedWithDetails;

  it('should return the first slot when there are no exceptions', () => {
    expect(getFirstActiveOccurrenceId(schedule(), PACED_ID)).toBe('indexedoccurrence_1_0');
  });

  it('should skip a disabled slot and return the next one', () => {
    const result = getFirstActiveOccurrenceId(
      schedule([exception({ occurrence_index: 0, disabled: true })]),
      PACED_ID
    );
    expect(result).toBe('indexedoccurrence_1_1');
  });

  it('should skip multiple consecutive disabled slots', () => {
    const result = getFirstActiveOccurrenceId(
      schedule([
        exception({ occurrence_index: 0, disabled: true }),
        exception({ occurrence_index: 1, disabled: true }),
        exception({ occurrence_index: 2, disabled: true }),
      ]),
      PACED_ID
    );
    expect(result).toBe('indexedoccurrence_1_3');
  });

  it('should pick the indexed slot whose start_time override makes it earliest', () => {
    const result = getFirstActiveOccurrenceId(
      schedule([
        // Slot 2 is moved before slot 0 by its start_time override
        exception({
          occurrence_index: 2,
          change_groups: { start_time: { value: PACED_START_MS - INTERVAL_MS } },
        }),
      ]),
      PACED_ID
    );
    expect(result).toBe('indexedoccurrence_1_2');
  });

  it('should pick an added exception when it is earlier than the first indexed slot', () => {
    const result = getFirstActiveOccurrenceId(
      schedule([
        exception({
          id: 42,
          change_groups: { start_time: { value: PACED_START_MS - INTERVAL_MS } },
        }),
      ]),
      PACED_ID
    );
    expect(result).toBe('exception_1_42');
  });

  it('should keep the indexed slot when an added exception comes after it', () => {
    const result = getFirstActiveOccurrenceId(
      schedule([
        exception({
          id: 42,
          change_groups: { start_time: { value: PACED_START_MS + 5 * INTERVAL_MS } },
        }),
      ]),
      PACED_ID
    );
    expect(result).toBe('indexedoccurrence_1_0');
  });

  it('should return undefined when every slot is disabled and no added exception exists', () => {
    const exceptions: SimulatedException[] = [];
    for (let i = 0; i < 6; i += 1) {
      exceptions.push(exception({ occurrence_index: i, disabled: true }));
    }
    expect(getFirstActiveOccurrenceId(schedule(exceptions), PACED_ID)).toBeUndefined();
  });
});
