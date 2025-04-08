import { describe, it, expect } from 'vitest';

import { Duration } from 'utils/duration';

import { getOccurrencesNb } from '../pacedTrain';

describe('getOccurrencesNb', () => {
  it('should properly compute occurrence nb for duration of 2h and step of 30min', () => {
    expect(
      getOccurrencesNb({ duration: Duration.parse('PT2H'), step: Duration.parse('PT30M') })
    ).toEqual(4);
  });

  it('should properly compute occurrence nb for duration of 30min and step of 20min', () => {
    expect(
      getOccurrencesNb({ duration: Duration.parse('PT30M'), step: Duration.parse('PT20M') })
    ).toEqual(2);
  });

  it('should properly compute occurrence nb for duration of 20min and step of 30min', () => {
    expect(
      getOccurrencesNb({ duration: Duration.parse('PT20M'), step: Duration.parse('PT30M') })
    ).toEqual(1);
  });

  it('should properly compute occurrence nb for duration of 0h and step of 30min', () => {
    expect(
      getOccurrencesNb({ duration: Duration.parse('PT0S'), step: Duration.parse('PT30M') })
    ).toEqual(0);
  });

  it('should properly compute occurrence nb for duration of 2h and step of 0min', () => {
    expect(() =>
      getOccurrencesNb({ duration: Duration.parse('PT2H'), step: Duration.parse('PT0S') })
    ).toThrow('Step cannot be 0');
  });
});
