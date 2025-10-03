import { describe, it, expect } from 'vitest';

import type { PathStep } from 'reducers/osrdconf/types';
import { Duration } from 'utils/duration';

import reversePathSteps from '../reversePathSteps';

describe('reversePathSteps', () => {
  const pathSteps: PathStep[] = [
    {
      coordinates: [-1.050442535980733, 49.227023973327874],
      positionOnPath: 0,
      name: 'Lison',
      kp: '295+200',
      arrival: null,
      theoreticalMargin: '0%',
      id: 'id205',
      location: {
        uic: 87447219,
        secondary_code: '00',
      },
    },
    {
      coordinates: [-1.0556643079994392, 49.22710024999522],
      positionOnPath: 381000,
      name: 'Lison',
      kp: '295+581',
      stopFor: new Duration({ milliseconds: 30 }),
      arrival: null,
      theoreticalMargin: '10%',
      id: 'id111',
      location: {
        uic: 87447219,
        secondary_code: 'JS',
      },
    },
    {
      coordinates: [-1.1270019417633528, 49.16208587851326],
      positionOnPath: 10402000,
      name: 'Pont-Hébert',
      kp: '10+396',
      arrival: new Duration({ milliseconds: 1500000 }),
      id: 'id117',
      location: {
        uic: 87447185,
        secondary_code: '00',
      },
    },
    {
      coordinates: [-1.1001532584044673, 49.11681385050178],
      positionOnPath: 18439000,
      name: 'St-Lô',
      kp: '18+467',
      stopFor: new Duration({ milliseconds: 50 }),
      arrival: null,
      id: 'id132',
      location: {
        uic: 87447003,
        secondary_code: '00',
      },
    },
    {
      coordinates: [-1.1572150034554578, 49.091813245871975],
      positionOnPath: 24476000,
      name: 'Via id97',
      arrival: null,
      theoreticalMargin: '2min/100km',
      id: 'id97',
      location: {
        track: '6146255e-6667-11e3-81ff-01f464e0362d',
        offset: 5715,
      },
    },
    {
      id: 'id206',
      deleted: false,
      location: {
        uic: 87447144,
        secondary_code: '00',
        track_reference: null,
      },
      name: 'Carantilly-Marigny',
      arrival: new Duration({ milliseconds: 3000000 }),
      stopFor: new Duration({ milliseconds: 0 }),
      locked: false,
      receptionSignal: 'OPEN',
      kp: '31+774',
      positionOnPath: 31750000,
      coordinates: [-1.24462141462551, 49.06795779874042],
    },
  ];

  const expectedReversedPathSteps: PathStep[] = [
    {
      id: 'id206',
      deleted: false,
      location: {
        uic: 87447144,
        secondary_code: '00',
        track_reference: null,
      },
      name: 'Carantilly-Marigny',
      arrival: null,
      stopFor: null,
      locked: false,
      receptionSignal: 'OPEN',
      theoreticalMargin: '2min/100km',
      kp: '31+774',
      positionOnPath: 31750000,
      coordinates: [-1.24462141462551, 49.06795779874042],
    },
    {
      coordinates: [-1.1572150034554578, 49.091813245871975],
      positionOnPath: 24476000,
      name: 'Via id97',
      arrival: null,
      theoreticalMargin: '10%',
      id: 'id97',
      location: {
        track: '6146255e-6667-11e3-81ff-01f464e0362d',
        offset: 5715,
      },
    },
    {
      coordinates: [-1.1001532584044673, 49.11681385050178],
      positionOnPath: 18439000,
      name: 'St-Lô',
      kp: '18+467',
      stopFor: new Duration({ milliseconds: 50 }),
      arrival: null,
      id: 'id132',
      location: {
        uic: 87447003,
        secondary_code: '00',
      },
    },
    {
      coordinates: [-1.1270019417633528, 49.16208587851326],
      positionOnPath: 10402000,
      name: 'Pont-Hébert',
      kp: '10+396',
      arrival: null,
      id: 'id117',
      location: {
        uic: 87447185,
        secondary_code: '00',
      },
    },
    {
      coordinates: [-1.0556643079994392, 49.22710024999522],
      positionOnPath: 381000,
      name: 'Lison',
      kp: '295+581',
      stopFor: new Duration({ milliseconds: 30 }),
      arrival: null,
      theoreticalMargin: '0%',
      id: 'id111',
      location: {
        uic: 87447219,
        secondary_code: 'JS',
      },
    },
    {
      coordinates: [-1.050442535980733, 49.227023973327874],
      positionOnPath: 0,
      name: 'Lison',
      kp: '295+200',
      arrival: null,
      id: 'id205',
      location: {
        uic: 87447219,
        secondary_code: '00',
      },
    },
  ];

  const expectedTwiceReversedPathSteps: PathStep[] = pathSteps.map((pathStep) => ({
    ...pathStep,
    arrival: null,
  }));
  expectedTwiceReversedPathSteps[pathSteps.length - 1].stopFor = null; // The 0ms stop on the last step will get add back later by another function

  it('should reverse path steps with times and margins correctly', () => {
    const reversedPathSteps = reversePathSteps(pathSteps);
    expect(reversedPathSteps).toEqual(expectedReversedPathSteps);
  });

  it('should equal itself with arrival times removed and last step 0ms stop missing when reversed twice', () => {
    const twiceReversedPathSteps = reversePathSteps(reversePathSteps(pathSteps));
    expect(twiceReversedPathSteps).toEqual(expectedTwiceReversedPathSteps);
  });
});
