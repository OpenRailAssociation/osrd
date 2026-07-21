import { normalizeUnits, type Units, type UnitProps } from '../DurationInput';

export const DEFAULT_PADCHAR = '0';
export const DEFAULT_MAX = Infinity;
export const DEFAULT_UNIT_KEYS: Units[] = ['h', 'm', 's', 'ms'];

const defaultUnitKeysCombinations: UnitProps[][] = [];

for (let i = 0; i < DEFAULT_UNIT_KEYS.length; i++) {
  for (let j = i + 2; j <= DEFAULT_UNIT_KEYS.length; j++) {
    defaultUnitKeysCombinations.push(DEFAULT_UNIT_KEYS.slice(i, j));
  }
} // [['h', 'm'], ['m', 's'] ... ['h', 'm', 's']

export const DEFAULT_UNIT_KEYS_COMBINATIONS = defaultUnitKeysCombinations;
export const DEFAULT_UNITS = normalizeUnits(
  DEFAULT_UNIT_KEYS as UnitProps[],
  DEFAULT_PADCHAR,
  DEFAULT_MAX
);

export const DEFAULT_VALUE = 0;
