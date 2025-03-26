import { describe, it, expect } from 'vitest';

import { Duration } from 'utils/duration';

import { getOccurrencesNb } from '../pacedTrain';

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
