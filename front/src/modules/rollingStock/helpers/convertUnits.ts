import { floor } from 'lodash';

import type { MultiUnit } from '../types';

const CONVERSION_FACTORS_SCHEMA: Partial<Record<MultiUnit, Partial<Record<MultiUnit, number>>>> = {
  t: { kg: 1000 },
  kg: { t: 1 / 1000 },
  'km/h': { 'm/s': 1 / 3.6 },
  'm/s': { 'km/h': 3.6 },
  N: { kN: 1 / 1000 },
  kN: { N: 1000 },
  'N/(m/s)': { 'N/(km/h)': 1 / 3.6, 'kN/(km/h)': 1 / (1000 * 3.6) },
  'N/(km/h)': { 'N/(m/s)': 3.6, 'kN/(km/h)': 1 / 1000 },
  'kN/(km/h)': { 'N/(m/s)': 1000 * 3.6, 'N/(km/h)': 1000 },
  'N/(m/s)²': { 'N/(km/h)²': 1 / 3.6 ** 2, 'kN/(km/h)²': 1 / (1000 * 3.6 ** 2) },
  'N/(km/h)²': { 'N/(m/s)²': 3.6 ** 2, 'kN/(km/h)²': 1 / 1000 },
  'kN/(km/h)²': { 'N/(m/s)²': 1000 * 3.6 ** 2, 'N/(km/h)²': 1000 },
};

/**
 * According the conversion factors schema, convert a value if
 * the factors exist in the schema
 */
const convertUnits = (
  prevUnit: MultiUnit,
  newUnit: MultiUnit,
  prevValue: number,
  maxDecimals?: number
): number => {
  let result = prevValue;
  const conversionFactorFromPrevUnit = CONVERSION_FACTORS_SCHEMA[prevUnit];
  if (conversionFactorFromPrevUnit && conversionFactorFromPrevUnit[newUnit]) {
    const conversionFactor = conversionFactorFromPrevUnit[newUnit];
    if (conversionFactor) result = conversionFactor * prevValue;
  }
  return maxDecimals ? floor(result, maxDecimals) : result;
};

export default convertUnits;
