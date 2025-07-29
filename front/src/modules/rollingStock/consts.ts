import type { Comfort, TrainMainCategory } from 'common/api/osrdEditoastApi';

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
