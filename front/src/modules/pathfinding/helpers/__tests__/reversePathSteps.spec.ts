import { describe, it, expect } from 'vitest';

import type { PathStep } from 'reducers/osrdconf/types';
import { Duration } from 'utils/duration';

import reversePathSteps from '../reversePathSteps';

describe('reversePathSteps', () => {
  const pathSteps: PathStep[] = [
    {
      arrival: null,
      theoreticalMargin: '0%',
      id: 'id205',
      location: {
        type: 'operational_point_part_reference',
        operational_point: {
          uic: 87447219,
          secondary_code: '00',
          type: 'uic',
        },
      },
      stopFor: null,
      receptionSignal: null,
    },
    {
      stopFor: new Duration({ milliseconds: 30 }),
      arrival: null,
      theoreticalMargin: '10%',
      id: 'id111',
      location: {
        type: 'operational_point_part_reference',
        operational_point: {
          uic: 87447219,
          secondary_code: 'JS',
          type: 'uic',
        },
      },
      receptionSignal: null,
    },
    {
      arrival: new Duration({ milliseconds: 1500000 }),
      id: 'id117',
      location: {
        type: 'operational_point_part_reference',
        operational_point: {
          uic: 87447185,
          secondary_code: '00',
          type: 'uic',
        },
      },
      stopFor: null,
      receptionSignal: null,
      theoreticalMargin: null,
    },
    {
      stopFor: new Duration({ milliseconds: 50 }),
      arrival: null,
      id: 'id132',
      location: {
        type: 'operational_point_part_reference',
        operational_point: {
          uic: 87447003,
          secondary_code: '00',
          type: 'uic',
        },
      },
      receptionSignal: null,
      theoreticalMargin: null,
    },
    {
      arrival: null,
      theoreticalMargin: '2min/100km',
      id: 'id97',
      location: {
        type: 'track_offset',
        track: '6146255e-6667-11e3-81ff-01f464e0362d',
        offset: 5715,
      },
      stopFor: null,
      receptionSignal: null,
    },
    {
      id: 'id206',
      location: {
        type: 'operational_point_part_reference',
        operational_point: {
          uic: 87447144,
          secondary_code: '00',
          type: 'uic',
        },
        local_track_name: null,
      },
      arrival: new Duration({ milliseconds: 3000000 }),
      stopFor: new Duration({ milliseconds: 0 }),
      receptionSignal: 'OPEN',
      theoreticalMargin: null,
    },
  ];

  const expectedReversedPathSteps: PathStep[] = [
    {
      id: 'id206',
      location: {
        type: 'operational_point_part_reference',
        operational_point: {
          uic: 87447144,
          secondary_code: '00',
          type: 'uic',
        },
        local_track_name: null,
      },
      arrival: null,
      stopFor: null,
      receptionSignal: 'OPEN',
      theoreticalMargin: '2min/100km',
    },
    {
      arrival: null,
      theoreticalMargin: '10%',
      id: 'id97',
      location: {
        type: 'track_offset',
        track: '6146255e-6667-11e3-81ff-01f464e0362d',
        offset: 5715,
      },
      stopFor: null,
      receptionSignal: null,
    },
    {
      stopFor: new Duration({ milliseconds: 50 }),
      arrival: null,
      id: 'id132',
      location: {
        type: 'operational_point_part_reference',
        operational_point: {
          uic: 87447003,
          secondary_code: '00',
          type: 'uic',
        },
      },
      receptionSignal: null,
      theoreticalMargin: null,
    },
    {
      arrival: null,
      id: 'id117',
      location: {
        type: 'operational_point_part_reference',
        operational_point: {
          uic: 87447185,
          secondary_code: '00',
          type: 'uic',
        },
      },
      stopFor: null,
      receptionSignal: null,
      theoreticalMargin: null,
    },
    {
      stopFor: new Duration({ milliseconds: 30 }),
      arrival: null,
      theoreticalMargin: '0%',
      id: 'id111',
      location: {
        type: 'operational_point_part_reference',
        operational_point: {
          uic: 87447219,
          secondary_code: 'JS',
          type: 'uic',
        },
      },
      receptionSignal: null,
    },
    {
      arrival: null,
      id: 'id205',
      location: {
        type: 'operational_point_part_reference',
        operational_point: {
          uic: 87447219,
          secondary_code: '00',
          type: 'uic',
        },
      },
      stopFor: new Duration({ milliseconds: 0 }),
      receptionSignal: null,
      theoreticalMargin: null,
    },
  ];

  const expectedTwiceReversedPathSteps: PathStep[] = pathSteps.map((pathStep) => ({
    ...pathStep,
    arrival: null,
  }));

  it('should reverse path steps with times and margins correctly', () => {
    const reversedPathSteps = reversePathSteps(pathSteps);
    expect(reversedPathSteps).toEqual(expectedReversedPathSteps);
  });

  it('should equal itself with arrival times removed and last step 0ms stop missing when reversed twice', () => {
    const twiceReversedPathSteps = reversePathSteps(reversePathSteps(pathSteps));
    expect(twiceReversedPathSteps).toEqual(expectedTwiceReversedPathSteps);
  });
});
