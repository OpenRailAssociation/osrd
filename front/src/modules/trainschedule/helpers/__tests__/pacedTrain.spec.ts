import { describe, it, expect } from 'vitest';

import type { PacedTrainException } from 'common/api/osrdEditoastApi';
import type { PacedTrainWithDetails } from 'modules/trainschedule/components/Timetable/types';
import type { PacedTrainId } from 'reducers/osrdconf/types';
import { Duration } from 'utils/duration';

import { formatPacedTrainWithOccurenceDetails, getOccurrencesNb } from '../pacedTrain';

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

describe('formatPacedTrainWithOccurenceDetails', () => {
  const pacedTrain: PacedTrainWithDetails = {
    id: 'paced_123' as PacedTrainId,
    name: '8608',
    labels: ['Paced-Train-Tag-1', 'SS-NS', 'Valid'],
    startTime: new Date('2024-10-15T03:00:00Z'),
    path: [
      { key: 'id227', deleted: false, uic: 6, secondary_code: 'BV' },
      { key: 'id228', deleted: false, uic: 5, secondary_code: 'BV' },
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
    speedLimitTag: 'MA100',
    paced: { timeWindow: Duration.parse('PT2H'), interval: Duration.parse('PT1H') },
    arrivalTime: new Date('2024-10-15T04:00:00Z'),
    duration: Duration.parse('PT1H'),
    stopsCount: 0,
    pathLength: '200',
    mechanicalEnergyConsumed: 5000,
    isValid: true,
    exceptions: [],
  };

  it('should properly update a standard property', () => {
    const exception: PacedTrainException = {
      key: '123123',
      train_name: { value: '8608 updated' },
    };
    const updatedPacedTrain = formatPacedTrainWithOccurenceDetails(pacedTrain, exception);
    expect(updatedPacedTrain).toEqual({
      ...pacedTrain,
      name: '8608 updated',
    });
  });

  it('should properly update speed limit tag with a null value', () => {
    const exception: PacedTrainException = {
      key: '123123',
      speed_limit_tag: { value: null },
    };
    const updatedPacedTrain = formatPacedTrainWithOccurenceDetails(pacedTrain, exception);
    expect(updatedPacedTrain).toEqual({
      ...pacedTrain,
      speedLimitTag: null,
    });
  });

  it('should properly update a property containing multiple ones', () => {
    const exception: PacedTrainException = {
      key: '123123',
      options: { value: { use_electrical_profiles: true } },
    };
    const updatedPacedTrain = formatPacedTrainWithOccurenceDetails(pacedTrain, exception);
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
          { key: 'id225', deleted: false, uic: 6, secondary_code: 'BV' },
          { key: 'id228', deleted: false, uic: 5, secondary_code: 'BV' },
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
    const updatedPacedTrain = formatPacedTrainWithOccurenceDetails(pacedTrain, exception);
    expect(updatedPacedTrain).toEqual({
      ...pacedTrain,
      path: exception.path_and_schedule!.path,
      margins: exception.path_and_schedule!.margins,
      power_restrictions: exception.path_and_schedule!.power_restrictions,
      schedule: exception.path_and_schedule!.schedule,
    });
  });
});
