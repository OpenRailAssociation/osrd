import type { Comfort, TrainMainCategory } from 'common/api/osrdEditoastApi';

import type { MultiUnit } from './types';

export const THERMAL_TRACTION_IDENTIFIER = 'thermal';
export const STANDARD_COMFORT_LEVEL: Comfort = 'STANDARD';

export const ComfortLevels: Record<Comfort, Comfort> = {
  STANDARD: 'STANDARD',
  AIR_CONDITIONING: 'AIR_CONDITIONING',
  HEATING: 'HEATING',
};

export const COMFORTS = Object.keys(ComfortLevels) as Comfort[];

// This dict is passthrough as we actually only need a list of categories, but using a dict lets typescript check
// that the keys perfectly corresponds to the API-provided keys or raise a type error, thus enforcing consistency
export const TrainMainCategoryDict: Record<TrainMainCategory, TrainMainCategory> = {
  HIGH_SPEED_TRAIN: 'HIGH_SPEED_TRAIN',
  INTERCITY_TRAIN: 'INTERCITY_TRAIN',
  REGIONAL_TRAIN: 'REGIONAL_TRAIN',
  COMMUTER_TRAIN: 'COMMUTER_TRAIN',
  FREIGHT_TRAIN: 'FREIGHT_TRAIN',
  FAST_FREIGHT_TRAIN: 'FAST_FREIGHT_TRAIN',
  NIGHT_TRAIN: 'NIGHT_TRAIN',
  TRAM_TRAIN: 'TRAM_TRAIN',
  TOURISTIC_TRAIN: 'TOURISTIC_TRAIN',
  WORK_TRAIN: 'WORK_TRAIN',
};

export const CONVERSION_FACTORS_SCHEMA: Partial<
  Record<MultiUnit, Partial<Record<MultiUnit, number>>>
> = {
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
