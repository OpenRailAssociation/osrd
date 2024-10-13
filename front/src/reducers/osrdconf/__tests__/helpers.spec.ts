import { describe, it, expect } from 'vitest';

import { ArrivalTimeTypes } from 'applications/stdcm/types';

import { updatePathStepAtIndex } from '../helpers';
import type { PathStep } from '../types';

describe('updatePathStepAtIndex', () => {
  const newPathStep = {
    operational_point: 'strasbourg',
    id: 'strasbourg',
    locked: true,
    coordinates: [48.58505541984412, 7.73387081978364],
    arrivalType: ArrivalTimeTypes.PRECISE_TIME,
  };

  let pathSteps: (PathStep | null)[] = [null, null];

  it('should replace the element completely when replaceCompletely is true', () => {
    pathSteps = updatePathStepAtIndex(pathSteps, 0, newPathStep, true);
    expect(pathSteps[0]).toEqual(newPathStep);
  });

  it('should merge updates with the existing element when replaceCompletely is false', () => {
    const updates = { arrivalType: ArrivalTimeTypes.ASAP };
    const expectedUpdatedElement = { ...newPathStep, ...updates };

    pathSteps = updatePathStepAtIndex(pathSteps, 0, updates, false);
    expect(pathSteps[0]).toEqual(expectedUpdatedElement);
  });
});
