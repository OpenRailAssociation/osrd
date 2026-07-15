import { describe, it, expect } from 'vitest';

import { Duration } from 'utils/duration';

import getTrainScheduleRepeatOffsets, { type TimeRange } from '../getTrainScheduleRepeatOffsets';

describe('getTrainScheduleRepeatOffsets', () => {
  it('should handle unique trains', () => {
    const result = getTrainScheduleRepeatOffsets(
      { paced: undefined },
      { start: new Duration({ minutes: -10 }), end: new Duration({ minutes: 85 }) }
    );
    expect(result).toEqual([Duration.zero]);
  });

  const testCases: {
    name: string;
    range: TimeRange;
    pacedTrainTimeWindow: Duration;
    instanceOffsets: Duration[];
  }[] = [
    {
      name: 'range exactly the same as paced train time window',
      range: { start: new Duration({ minutes: 0 }), end: new Duration({ minutes: 60 }) },
      pacedTrainTimeWindow: new Duration({ minutes: 60 }),
      instanceOffsets: [Duration.zero],
    },
    {
      name: 'range smaller than paced train time window with no offset',
      range: { start: new Duration({ minutes: 10 }), end: new Duration({ minutes: 20 }) },
      pacedTrainTimeWindow: new Duration({ minutes: 60 }),
      instanceOffsets: [Duration.zero],
    },
    {
      name: 'range smaller than paced train time window with positive offset',
      range: { start: new Duration({ minutes: 75 }), end: new Duration({ minutes: 80 }) },
      pacedTrainTimeWindow: new Duration({ minutes: 60 }),
      instanceOffsets: [new Duration({ minutes: 60 })],
    },
    {
      name: 'range smaller than paced train time window with negative offset',
      range: { start: new Duration({ minutes: -10 }), end: new Duration({ minutes: 0 }) },
      pacedTrainTimeWindow: new Duration({ minutes: 60 }),
      instanceOffsets: [new Duration({ minutes: -60 })],
    },
    {
      name: 'range larger than paced train time window',
      range: { start: new Duration({ minutes: -10 }), end: new Duration({ minutes: 85 }) },
      pacedTrainTimeWindow: new Duration({ minutes: 60 }),
      instanceOffsets: [
        new Duration({ minutes: -60 }),
        new Duration({ minutes: 0 }),
        new Duration({ minutes: 60 }),
      ],
    },
  ];
  it.for(testCases)('should handle $name', ({ range, pacedTrainTimeWindow, instanceOffsets }) => {
    const result = getTrainScheduleRepeatOffsets(
      {
        paced: {
          timeWindow: pacedTrainTimeWindow,
          interval: new Duration({ minutes: 15 }),
          exceptions: [],
          exceptionProjections: new Map(),
        },
      },
      range
    );
    expect(result).toEqual(instanceOffsets);
  });
});
