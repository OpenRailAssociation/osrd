import { describe, it, expect } from 'vitest';

import type { PacedTrain, PacedTrainException } from 'common/api/osrdEditoastApi';
import type { SimulatedException, SimulationSummary } from 'modules/timetableItem/types';
import { Duration } from 'utils/duration';

import {
  extractOccurrenceDetailsFromPacedTrain,
  getOccurrencesNb,
  getOccurrencesWorstStatus,
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
  const pacedTrain: Omit<PacedTrain, 'paced' | 'exceptions'> = {
    train_name: '8608',
    labels: ['Paced-Train-Tag-1', 'SS-NS', 'Valid'],
    rolling_stock_name: '',
    start_time: '2024-10-15T03:00:00Z',
    path: [
      { id: 'id227', deleted: false, uic: 6, secondary_code: 'BV' },
      { id: 'id228', deleted: false, uic: 5, secondary_code: 'BV' },
    ],
    schedule: [
      {
        at: 'id228',
        arrival: null,
        stop_for: 'P0D',
        reception_signal: 'OPEN',
        locked: false,
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
    const exception: PacedTrainException = {
      key: '123123',
      train_name: { value: '8608 updated' },
    };
    const updatedPacedTrain = extractOccurrenceDetailsFromPacedTrain(pacedTrain, exception);
    expect(updatedPacedTrain).toEqual({
      ...pacedTrain,
      train_name: '8608 updated',
    });
  });

  it('should properly update speed limit tag with a null value', () => {
    const exception: PacedTrainException = {
      key: '123123',
      speed_limit_tag: { value: null },
    };
    const updatedPacedTrain = extractOccurrenceDetailsFromPacedTrain(pacedTrain, exception);
    expect(updatedPacedTrain).toEqual({
      ...pacedTrain,
      speed_limit_tag: null,
    });
  });

  it('should properly update a property containing multiple ones', () => {
    const exception: PacedTrainException = {
      key: '123123',
      options: { value: { use_electrical_profiles: true } },
    };
    const updatedPacedTrain = extractOccurrenceDetailsFromPacedTrain(pacedTrain, exception);
    expect(updatedPacedTrain).toEqual({
      ...pacedTrain,
      options: {
        use_electrical_profiles: true,
      },
    });
  });

  it('should properly update path and schedule change group', () => {
    const exception: PacedTrainException = {
      key: '123123',
      path_and_schedule: {
        path: [
          { id: 'id225', deleted: false, uic: 6, secondary_code: 'BV' },
          { id: 'id228', deleted: false, uic: 5, secondary_code: 'BV' },
        ],
        schedule: [
          {
            at: 'id228',
            arrival: null,
            stop_for: 'P0D',
            reception_signal: 'OPEN',
            locked: false,
          },
        ],
        margins: { boundaries: [], values: ['0%'] },
        power_restrictions: [],
      },
    };
    const updatedPacedTrain = extractOccurrenceDetailsFromPacedTrain(pacedTrain, exception);
    expect(updatedPacedTrain).toEqual({
      ...pacedTrain,
      path: exception.path_and_schedule!.path,
      margins: exception.path_and_schedule!.margins,
      power_restrictions: exception.path_and_schedule!.power_restrictions,
      schedule: exception.path_and_schedule!.schedule,
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
        getOccurrencesWorstStatus({
          summary: invalidSummary,
          exceptions: [
            { summary: validSummary } as SimulatedException,
            { summary: validLateSummary } as SimulatedException,
            { summary: validTooFastSummary } as SimulatedException,
          ],
        })
      ).toEqual('invalid');
    });

    it('should return invalid if the train model is invalid and some occurrences are late', () => {
      expect(
        getOccurrencesWorstStatus({
          summary: invalidSummary,
          exceptions: [
            { summary: validSummary } as SimulatedException,
            { summary: validLateSummary } as SimulatedException,
            { summary: validTooFastSummary } as SimulatedException,
          ],
        })
      ).toEqual('invalid');
    });

    it('should return invalid if the train model is late but an occurrence is invalid', () => {
      expect(
        getOccurrencesWorstStatus({
          summary: validLateSummary,
          exceptions: [
            { summary: validSummary } as SimulatedException,
            { summary: invalidSummary } as SimulatedException,
            { summary: validTooFastSummary } as SimulatedException,
          ],
        })
      ).toEqual('invalid');
    });

    it('should return invalid if the train model is too fast but an occurrence is invalid', () => {
      expect(
        getOccurrencesWorstStatus({
          summary: validTooFastSummary,
          exceptions: [
            { summary: validSummary } as SimulatedException,
            { summary: invalidSummary } as SimulatedException,
            { summary: validTooFastSummary } as SimulatedException,
          ],
        })
      ).toEqual('invalid');
    });

    it('should return invalid if the train model is valid and on time but an occurrence is invalid', () => {
      expect(
        getOccurrencesWorstStatus({
          summary: validSummary,
          exceptions: [
            { summary: validSummary } as SimulatedException,
            { summary: invalidSummary } as SimulatedException,
            { summary: validTooFastSummary } as SimulatedException,
          ],
        })
      ).toEqual('invalid');
    });
  });

  describe('should return late', () => {
    it('should return late if the train model and some occurrences are late', () => {
      expect(
        getOccurrencesWorstStatus({
          summary: validLateSummary,
          exceptions: [
            { summary: validSummary } as SimulatedException,
            { summary: validLateSummary } as SimulatedException,
            { summary: validTooFastSummary } as SimulatedException,
          ],
        })
      ).toEqual('scheduleNotHonored');
    });

    it('should return late if the train model is too fast but an occurrence is late', () => {
      expect(
        getOccurrencesWorstStatus({
          summary: validTooFastSummary,
          exceptions: [
            { summary: validSummary } as SimulatedException,
            { summary: validLateSummary } as SimulatedException,
            { summary: validTooFastSummary } as SimulatedException,
          ],
        })
      ).toEqual('scheduleNotHonored');
    });

    it('should return late if the train model is late and an occurrence is invalid but disabled', () => {
      expect(
        getOccurrencesWorstStatus({
          summary: validLateSummary,
          exceptions: [
            { summary: validSummary } as SimulatedException,
            { summary: invalidSummary, disabled: true } as SimulatedException,
          ],
        })
      ).toEqual('scheduleNotHonored');
    });

    it('should return late if the train model is valid and on time but an occurrence is late', () => {
      expect(
        getOccurrencesWorstStatus({
          summary: validSummary,
          exceptions: [
            { summary: validSummary } as SimulatedException,
            { summary: validLateSummary } as SimulatedException,
            { summary: validTooFastSummary } as SimulatedException,
          ],
        })
      ).toEqual('scheduleNotHonored');
    });
  });

  describe('should return too fast', () => {
    it('should return too fast if the train model is too fast and the occurrences are valid and on time', () => {
      expect(
        getOccurrencesWorstStatus({
          summary: validTooFastSummary,
          exceptions: [
            { summary: validSummary } as SimulatedException,
            { summary: validSummary } as SimulatedException,
          ],
        })
      ).toEqual('trainTooFast');
    });

    it('should return too fast if the train model is valid and on time and one of the occurrences is too fast', () => {
      expect(
        getOccurrencesWorstStatus({
          summary: validSummary,
          exceptions: [
            { summary: validSummary } as SimulatedException,
            { summary: validTooFastSummary } as SimulatedException,
          ],
        })
      ).toEqual('trainTooFast');
    });

    it('should return too fast if the train model is too fast and an occurrence is invalid or late but disabled', () => {
      expect(
        getOccurrencesWorstStatus({
          summary: validTooFastSummary,
          exceptions: [
            { summary: validSummary } as SimulatedException,
            { summary: validTooFastSummary, disabled: true } as SimulatedException,
            { summary: invalidSummary, disabled: true } as SimulatedException,
          ],
        })
      ).toEqual('trainTooFast');
    });
  });

  describe('should return nothing', () => {
    it('should return nothing if the train model and all the occurrences are valid and on time', () => {
      expect(
        getOccurrencesWorstStatus({
          summary: validSummary,
          exceptions: [
            { summary: validSummary } as SimulatedException,
            { summary: validSummary } as SimulatedException,
          ],
        })
      ).toEqual('');
    });

    it('should return nothing if some occurrences are invalid, late or too fast but disabled', () => {
      expect(
        getOccurrencesWorstStatus({
          summary: validSummary,
          exceptions: [
            { summary: validSummary } as SimulatedException,
            { summary: invalidSummary, disabled: true } as SimulatedException,
            { summary: validLateSummary, disabled: true } as SimulatedException,
            { summary: validTooFastSummary, disabled: true } as SimulatedException,
          ],
        })
      ).toEqual('');
    });
  });
});
