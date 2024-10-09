import { describe, it, expect } from 'vitest';

import {
  effortCurves,
  voltageRangesForPowerRestrictions,
  formattedPowerRestrictionRanges,
  powerRestriction,
  powerRestrictionRanges,
  powerRestrictionRangesWithHandled,
  stepPath,
  stepPathPositions,
} from './sampleData';
import {
  convertPowerRestrictionsAndCheckCompatibility,
  formatPowerRestrictionRanges,
} from '../formatPowerRestrictionRangesWithHandled';

describe('formatPowerRestrictionRanges', () => {
  it('should properly format power restrictions ranges', () => {
    const result = formatPowerRestrictionRanges(powerRestriction, stepPath, stepPathPositions);

    expect(result).toEqual(formattedPowerRestrictionRanges);
  });
});

describe('addHandledToPowerRestrictions', () => {
  it('should properly format power restrictions ranges with handled property', () => {
    const result = convertPowerRestrictionsAndCheckCompatibility(
      powerRestrictionRanges,
      voltageRangesForPowerRestrictions,
      effortCurves
    );

    expect(result).toEqual(powerRestrictionRangesWithHandled);
  });
});
