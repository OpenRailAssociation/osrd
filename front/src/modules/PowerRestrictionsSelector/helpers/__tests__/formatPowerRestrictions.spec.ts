import { describe, it, expect } from 'vitest';

import type { PowerRestriction } from 'applications/operationalStudies/types';
import type { IntervalItem } from 'common/IntervalsEditor/types';
import { NO_POWER_RESTRICTION } from 'modules/powerRestriction/consts';
import type { PathStep } from 'reducers/osrdconf/types';
import { mToMm } from 'utils/physics';

import formatPowerRestrictions from '../formatPowerRestrictions';

describe('formatPowerRestrictions', () => {
  const powerRestrictions: PowerRestriction[] = [
    {
      from: 'a',
      to: 'b',
      value: 'A',
    },
    {
      from: 'd',
      to: 'e',
      value: 'B',
    },
  ];
  const pathSteps: PathStep[] = [
    { id: 'a', positionOnPath: mToMm(140) } as PathStep,
    { id: 'b', positionOnPath: mToMm(180) } as PathStep,
    { id: 'c', positionOnPath: mToMm(300) } as PathStep,
    { id: 'd', positionOnPath: mToMm(650) } as PathStep,
    { id: 'e', positionOnPath: mToMm(700) } as PathStep,
  ];

  const customRanges: IntervalItem[] = [
    { begin: 200, end: 340, value: NO_POWER_RESTRICTION },
    { begin: 800, end: 860, value: NO_POWER_RESTRICTION },
  ];

  const changePoints = [200, 400, 800];

  const pathLength = 1000;

  it('should properly format the power restriction ranges if everything is empty', () => {
    const result = formatPowerRestrictions([], [], [], [], pathLength);
    expect(result).toEqual([{ begin: 0, end: 1000, value: NO_POWER_RESTRICTION }]);
  });

  it('should properly format the power restriction ranges if some electrification change points are given', () => {
    const result = formatPowerRestrictions([], [], [], changePoints, pathLength);
    expect(result).toEqual([
      { begin: 0, end: 200, value: NO_POWER_RESTRICTION },
      { begin: 200, end: 400, value: NO_POWER_RESTRICTION },
      { begin: 400, end: 800, value: NO_POWER_RESTRICTION },
      { begin: 800, end: 1000, value: NO_POWER_RESTRICTION },
    ]);
  });

  it('should properly format the power restriction ranges without powerRestrictions', () => {
    const result = formatPowerRestrictions([], [], customRanges, changePoints, pathLength);
    expect(result).toEqual([
      { begin: 0, end: 200, value: NO_POWER_RESTRICTION },
      { begin: 200, end: 340, value: NO_POWER_RESTRICTION }, // custom range
      { begin: 340, end: 400, value: NO_POWER_RESTRICTION },
      { begin: 400, end: 800, value: NO_POWER_RESTRICTION },
      { begin: 800, end: 860, value: NO_POWER_RESTRICTION }, // custom range
      { begin: 860, end: 1000, value: NO_POWER_RESTRICTION },
    ]);
  });

  it('should properly format the power restriction ranges with power restrictions', () => {
    const result = formatPowerRestrictions(
      powerRestrictions,
      pathSteps,
      customRanges,
      changePoints,
      pathLength
    );
    expect(result).toEqual([
      { begin: 0, end: 140, value: NO_POWER_RESTRICTION },
      { begin: 140, end: 180, value: 'A' }, // power restriction
      { begin: 180, end: 200, value: NO_POWER_RESTRICTION },
      { begin: 200, end: 340, value: NO_POWER_RESTRICTION }, // custom range
      { begin: 340, end: 400, value: NO_POWER_RESTRICTION }, // change point
      { begin: 400, end: 650, value: NO_POWER_RESTRICTION }, // change point
      { begin: 650, end: 700, value: 'B' }, // power restriction
      { begin: 700, end: 800, value: NO_POWER_RESTRICTION },
      { begin: 800, end: 860, value: NO_POWER_RESTRICTION }, // custom range
      { begin: 860, end: 1000, value: NO_POWER_RESTRICTION },
    ]);
  });

  it('should throw an error if a pathStep is not found', () => {
    expect(() =>
      formatPowerRestrictions(powerRestrictions, [], customRanges, changePoints, pathLength)
    ).toThrowError('Impossible to locate the path step a while formatting the power restrictions');
  });

  it('should throw an error if a pathStep has no positionOnPath', () => {
    expect(() =>
      formatPowerRestrictions(
        powerRestrictions,
        [{ id: 'a' } as PathStep, ...pathSteps.slice(1)],
        customRanges,
        changePoints,
        pathLength
      )
    ).toThrowError('Impossible to locate a path step while formatting the power restrictions');
  });
});
