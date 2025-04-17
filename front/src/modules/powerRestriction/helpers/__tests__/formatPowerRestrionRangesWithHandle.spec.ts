import type { LayerData, PowerRestrictionValues } from '@osrd-project/ui-charts';
import { describe, it, expect } from 'vitest';

import type { TrainSchedule } from 'common/api/osrdEditoastApi';
import type { RangedValue } from 'common/types';

import {
  convertPowerRestrictionsAndCheckCompatibility,
  formatPowerRestrictionRanges,
} from '../formatPowerRestrictionRangesWithHandled';
import generateEffortCurvesForTests from './generateEffortCurvesForTests';

describe('formatPowerRestrictionRanges', () => {
  it('should properly format power restrictions ranges', () => {
    const powerRestrictions: NonNullable<TrainSchedule['power_restrictions']> = [
      {
        from: 'step1',
        to: 'step2',
        value: 'code1',
      },
      {
        from: 'step3',
        to: 'step4',
        value: 'code2',
      },
    ];
    const pathSteps: TrainSchedule['path'] = [
      {
        uic: 12345,
        id: 'step1',
      },
      {
        uic: 45686,
        id: 'step2',
      },
      {
        uic: 93405,
        id: 'step3',
      },
      {
        uic: 93405,
        id: 'step4',
      },
    ];
    const pathStepPositions = [0, 1000, 2000, 3000];

    const result = formatPowerRestrictionRanges(powerRestrictions, pathSteps, pathStepPositions);

    expect(result).toEqual([
      {
        position: { start: 0, end: 1000 },
        value: { powerRestriction: 'code1' },
      },
      {
        position: { start: 2000, end: 3000 },
        value: { powerRestriction: 'code2' },
      },
    ]);
  });
});

describe('addHandledToPowerRestrictions', () => {
  it('should properly format power restrictions ranges with handled property', () => {
    const powerRestrictionRanges: LayerData<Omit<PowerRestrictionValues, 'handled'>>[] = [
      {
        position: { start: 0, end: 1000000 },
        value: { powerRestriction: 'code1' },
      },
      {
        position: { start: 2000000, end: 3000000 },
        value: { powerRestriction: 'code2' },
      },
      {
        position: { start: 3000000, end: 4000000 },
        value: { powerRestriction: 'code1' },
      },
    ];

    const voltageRangesForPowerRestrictions: RangedValue[] = [
      {
        begin: 0,
        end: 2000,
        value: '1500V',
      },
      {
        begin: 2000,
        end: 3000,
        value: '',
      },
      {
        begin: 3000,
        end: 4000,
        value: '25000V',
      },
    ];

    const effortCurves = generateEffortCurvesForTests({
      '1500V': [
        {
          electricalProfile: 'level1',
          powerRestrictionCode: 'code1',
        },
        {
          electricalProfile: 'level1',
          powerRestrictionCode: 'code2',
        },
        {
          electricalProfile: 'level1',
          powerRestrictionCode: 'code2',
          comfort: 'AIR_CONDITIONING',
        },
      ],
      '25000V': [
        {
          electricalProfile: 'level2',
          powerRestrictionCode: 'code3',
        },
        {
          electricalProfile: 'level2',
          powerRestrictionCode: 'code4',
        },
      ],
    });

    const result = convertPowerRestrictionsAndCheckCompatibility(
      powerRestrictionRanges,
      voltageRangesForPowerRestrictions,
      effortCurves
    );

    expect(result).toEqual([
      {
        position: { start: 0, end: 1 },
        value: { powerRestriction: 'code1', handled: true },
      },
      {
        position: { start: 2, end: 3 },
        value: { powerRestriction: 'code2', handled: false },
      },
      {
        position: { start: 3, end: 4 },
        value: { powerRestriction: 'code1', handled: false },
      },
    ]);
  });
});
