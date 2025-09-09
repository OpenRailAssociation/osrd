import type { TrainMainCategory } from 'common/api/osrdEditoastApi';

import type { AspectLabel } from './types';

export const TAG_COLORS = {
  MISSING: '#94918E',
  GIVEN_TRAIN: '#494641',
  FALLBACK: '#216482',
  INCOMPATIBLE: '#EAA72B',
};

export const OCCUPANCY_BLOCKS_COLORS = {
  FREE: '#CAEDDB',
  SEMAPHORE: '#FFD4D8',
  WARNING: '#FFEABF',
  GREY: '#D3D1CF',
};

export const ASPECT_LABELS_COLORS: Record<AspectLabel, string> = {
  VL: OCCUPANCY_BLOCKS_COLORS.FREE,
  '300VL': OCCUPANCY_BLOCKS_COLORS.FREE,
  S: OCCUPANCY_BLOCKS_COLORS.SEMAPHORE,
  OCCUPIED: OCCUPANCY_BLOCKS_COLORS.SEMAPHORE,
  C: OCCUPANCY_BLOCKS_COLORS.SEMAPHORE,
  RRR: OCCUPANCY_BLOCKS_COLORS.SEMAPHORE,
  '(A)': OCCUPANCY_BLOCKS_COLORS.WARNING,
  A: OCCUPANCY_BLOCKS_COLORS.WARNING,
  '300(VL)': OCCUPANCY_BLOCKS_COLORS.GREY,
  '270A': OCCUPANCY_BLOCKS_COLORS.GREY,
  '220A': OCCUPANCY_BLOCKS_COLORS.GREY,
  '160A': OCCUPANCY_BLOCKS_COLORS.GREY,
  '080A': OCCUPANCY_BLOCKS_COLORS.GREY,
  '000': OCCUPANCY_BLOCKS_COLORS.GREY,
};

export const DEFAULT_TRAIN_PATH_COLORS = {
  normal: '#797671',
  hovered: '#494641',
  background: '#EBEBEA',
};

export const TRAIN_MAIN_CATEGORY_PATH_COLORS: Record<
  TrainMainCategory,
  { normal: string; hovered: string; background: string }
> = {
  HIGH_SPEED_TRAIN: { normal: '#E5221A', hovered: '#912420', background: '#FAE7E6' },
  INTERCITY_TRAIN: { normal: '#B2539E', hovered: '#732963', background: '#FAE6F6' },
  REGIONAL_TRAIN: { normal: '#C75300', hovered: '#803500', background: '#FFE7D6' },
  NIGHT_TRAIN: { normal: '#8757E6', hovered: '#58318F', background: '#E5E7FF' },
  COMMUTER_TRAIN: { normal: '#127DB8', hovered: '#165070', background: '#D9F2FF' },
  FREIGHT_TRAIN: { normal: '#54823B', hovered: '#2C4F19', background: '#E4EDDF' },
  FAST_FREIGHT_TRAIN: { normal: '#13857B', hovered: '#085953', background: '#DAF7EE' },
  TRAM_TRAIN: { normal: '#687C5C', hovered: '#444D3C', background: '#E1EDD8' },
  TOURISTIC_TRAIN: { normal: '#8A714B', hovered: '#594525', background: '#EEE7D9' },
  WORK_TRAIN: { normal: '#996E00', hovered: '#634A00', background: '#FCEEC2' },
};
