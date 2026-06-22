import type { TrainMainCategory } from 'common/api/osrdEditoastApi';

import type { CategoryColors } from './types';

export const SELECTED_CURVE_COLOR = '#1844EF';
export const SELECTED_CURVE_SOFT_COLOR = '#72A8F7'; // Used for the TOD occupancy halo.
export const SELECTED_CURVE_OUTLINE_COLOR = 'rgba(24, 68, 239, 0.1)';
export const DRAGGED_CURVE_COLOR = '#180F47';
export const DRAGGED_CURVE_OUTLINE_COLOR = 'rgba(255, 247, 0, 0.4)';
export const REST_BACKGROUND_COLOR = '#FFFFFF';

export const DEFAULT_TRAIN_PATH_COLORS: CategoryColors = {
  base: '#797671',
  strong: '#494641',
  surface: '#EBEBEA',
  soft: '#b6b2af',
};

export const TRAIN_MAIN_CATEGORY_PATH_COLORS: Record<TrainMainCategory, CategoryColors> = {
  HIGH_SPEED_TRAIN: { base: '#E5221A', strong: '#912420', surface: '#FAE7E6', soft: '#ff7873' },
  INTERCITY_TRAIN: { base: '#B2539E', strong: '#732963', surface: '#FAE6F6', soft: '#ea94d8' },
  REGIONAL_TRAIN: { base: '#C75300', strong: '#803500', surface: '#FFE7D6', soft: '#ff8b38' },
  NIGHT_TRAIN: { base: '#8757E6', strong: '#58318F', surface: '#E5E7FF', soft: '#b3a1ff' },
  COMMUTER_TRAIN: { base: '#127DB8', strong: '#165070', surface: '#D9F2FF', soft: '#45abe2' },
  FREIGHT_TRAIN: { base: '#54823B', strong: '#2C4F19', surface: '#E4EDDF', soft: '#86ba68' },
  FAST_FREIGHT_TRAIN: {
    base: '#13857B',
    strong: '#085953',
    surface: '#DAF7EE',
    soft: '#55b7af',
  },
  TRAM_TRAIN: { base: '#687C5C', strong: '#444D3C', surface: '#E1EDD8', soft: '#93ad82' },
  TOURISTIC_TRAIN: { base: '#8A714B', strong: '#594525', surface: '#EEE7D9', soft: '#b39e7e' },
  WORK_TRAIN: { base: '#996E00', strong: '#634A00', surface: '#FCEEC2', soft: '#ffb700' },
};
