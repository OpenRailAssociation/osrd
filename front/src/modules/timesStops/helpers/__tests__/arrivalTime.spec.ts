import { describe } from 'vitest';

import { time2sec } from 'utils/timeManipulation';

import { checkAndFormatCalculatedArrival } from '../arrivalTime';

describe('checkAndFormatCalculatedArrival', () => {
  it('should return the schedule arrival value if the difference of 2 values <= 1 second', () => {
    const schedule = {
      arrival: 3600,
      departure: 4100,
      stopFor: 500,
    };
    const operationalPointTime = time2sec('01:00:00');
    expect(checkAndFormatCalculatedArrival(schedule, operationalPointTime)).toEqual('01:00:00');
    expect(checkAndFormatCalculatedArrival(schedule, operationalPointTime + 0.5)).toEqual(
      '01:00:00'
    );
    expect(checkAndFormatCalculatedArrival(schedule, operationalPointTime + 1)).toEqual('01:00:00');
    expect(checkAndFormatCalculatedArrival(schedule, operationalPointTime + 1.5)).toEqual(
      '01:00:01'
    );

    expect(checkAndFormatCalculatedArrival(schedule, operationalPointTime - 1)).toEqual('01:00:00');
    expect(checkAndFormatCalculatedArrival(schedule, operationalPointTime - 1.5)).toEqual(
      '00:59:58'
    );
  });
});
