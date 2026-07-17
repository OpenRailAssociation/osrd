import { describe, it, expect } from 'vitest';

import type { BaseTrainProjection } from 'modules/simulationResult/types';
import { Duration } from 'utils/duration';

import getTrainScheduleRepeatOffsets, { type TimeRange } from '../getTrainScheduleRepeatOffsets';

function buildProjection(duration: Duration): BaseTrainProjection {
  return {
    spaceTimeCurves: [
      {
        positions: [0, 500, 1000],
        times: [0, duration.ms / 2, duration.ms],
      },
    ],
    signalUpdates: [],
  };
}

describe('getTrainScheduleRepeatOffsets', () => {
  it('should handle unique trains', () => {
    const result = getTrainScheduleRepeatOffsets(
      { ...buildProjection(new Duration({ minutes: 64 })), paced: undefined },
      { start: new Duration({ minutes: -10 }), end: new Duration({ minutes: 85 }) }
    );
    expect(result).toEqual([Duration.zero]);
  });

  const testCases: {
    name: string;
    range: TimeRange;
    pacedTrainTimeWindow: Duration;
    pacedTrainTravelTime: Duration;
    exceptionTravelTime?: Duration;
    instanceOffsets: Duration[];
  }[] = [
    {
      name: 'range exactly the same as paced train time window',
      range: { start: new Duration({ minutes: 0 }), end: new Duration({ minutes: 60 }) },
      pacedTrainTimeWindow: new Duration({ minutes: 60 }),
      pacedTrainTravelTime: Duration.zero,
      instanceOffsets: [Duration.zero],
    },
    {
      name: 'range smaller than paced train time window with no offset',
      range: { start: new Duration({ minutes: 10 }), end: new Duration({ minutes: 20 }) },
      pacedTrainTimeWindow: new Duration({ minutes: 60 }),
      pacedTrainTravelTime: Duration.zero,
      instanceOffsets: [Duration.zero],
    },
    {
      name: 'range smaller than paced train time window with positive offset',
      range: { start: new Duration({ minutes: 75 }), end: new Duration({ minutes: 80 }) },
      pacedTrainTimeWindow: new Duration({ minutes: 60 }),
      pacedTrainTravelTime: Duration.zero,
      instanceOffsets: [new Duration({ minutes: 60 })],
    },
    {
      name: 'range smaller than paced train time window with negative offset',
      range: { start: new Duration({ minutes: -10 }), end: new Duration({ minutes: 0 }) },
      pacedTrainTimeWindow: new Duration({ minutes: 60 }),
      pacedTrainTravelTime: Duration.zero,
      instanceOffsets: [new Duration({ minutes: -60 })],
    },
    {
      name: 'range larger than paced train time window',
      range: { start: new Duration({ minutes: -10 }), end: new Duration({ minutes: 85 }) },
      pacedTrainTimeWindow: new Duration({ minutes: 60 }),
      pacedTrainTravelTime: Duration.zero,
      instanceOffsets: [
        new Duration({ minutes: -60 }),
        new Duration({ minutes: 0 }),
        new Duration({ minutes: 60 }),
      ],
    },
    {
      name: 'paced train travel time smaller than paced train time window',
      range: { start: new Duration({ minutes: -50 }), end: new Duration({ minutes: 85 }) },
      pacedTrainTimeWindow: new Duration({ minutes: 60 }),
      pacedTrainTravelTime: new Duration({ minutes: 12 }),
      instanceOffsets: [
        new Duration({ minutes: -120 }),
        new Duration({ minutes: -60 }),
        new Duration({ minutes: 0 }),
        new Duration({ minutes: 60 }),
      ],
    },
    {
      name: 'paced train travel time larger than paced train time window',
      range: { start: new Duration({ minutes: -50 }), end: new Duration({ minutes: 85 }) },
      pacedTrainTimeWindow: new Duration({ minutes: 60 }),
      pacedTrainTravelTime: new Duration({ minutes: 90 }),
      instanceOffsets: [
        new Duration({ minutes: -180 }),
        new Duration({ minutes: -120 }),
        new Duration({ minutes: -60 }),
        new Duration({ minutes: 0 }),
        new Duration({ minutes: 60 }),
      ],
    },
    {
      name: 'exception travel time',
      range: { start: new Duration({ minutes: -50 }), end: new Duration({ minutes: 85 }) },
      pacedTrainTimeWindow: new Duration({ minutes: 60 }),
      pacedTrainTravelTime: new Duration({ minutes: 1 }),
      exceptionTravelTime: new Duration({ minutes: 32 }),
      instanceOffsets: [
        new Duration({ minutes: -120 }),
        new Duration({ minutes: -60 }),
        new Duration({ minutes: 0 }),
        new Duration({ minutes: 60 }),
      ],
    },
  ];
  it.for(testCases)(
    'should handle $name',
    ({
      range,
      pacedTrainTimeWindow,
      pacedTrainTravelTime,
      exceptionTravelTime,
      instanceOffsets,
    }) => {
      const exceptionId = 20;
      const result = getTrainScheduleRepeatOffsets(
        {
          ...buildProjection(pacedTrainTravelTime),
          paced: {
            timeWindow: pacedTrainTimeWindow,
            interval: new Duration({ minutes: 15 }),
            exceptions: exceptionTravelTime
              ? [
                  {
                    id: exceptionId,
                    key: 'foo',
                  },
                ]
              : [],
            exceptionProjections: new Map(
              exceptionTravelTime ? [[exceptionId, buildProjection(exceptionTravelTime)]] : []
            ),
          },
        },
        range
      );
      expect(result).toEqual(instanceOffsets);
    }
  );
});
