import type { TrainMainCategory } from 'common/api/osrdEditoastApi';

import type { CategoryColors } from './types';

export const DEFAULT_TRAIN_PATH_COLORS: CategoryColors = {
  normal: '#797671',
  hovered: '#494641',
  background: '#EBEBEA',
};

export const TRAIN_MAIN_CATEGORY_PATH_COLORS: Record<TrainMainCategory, CategoryColors> = {
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
