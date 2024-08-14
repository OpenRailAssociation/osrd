import type { ArrayElement, ValueOf } from 'utils/types';

// CHARTS

export const CHART_AXES = {
  SPACE_TIME: ['time', 'position'],
  SPACE_SPEED: ['position', 'speed'],
  SPACE_GRADIENT: ['position', 'gradient'],
  SPACE_RADIUS: ['position', 'radius'],
  SPACE_HEIGHT: ['position', 'height'],
} as const;

export type ChartAxes = ValueOf<typeof CHART_AXES>;
export type XAxis = ChartAxes[0];
export type YAxis = ChartAxes[1];
export type Y2Axis = typeof CHART_AXES.SPACE_HEIGHT;

export const LIST_VALUES = {
  SPACE_TIME: [
    'headPosition',
    'tailPosition',
    'speed',
    'margins_speed',
    'eco_speed',
    'eco_headPosition',
    'eco_tailPosition',
  ],
  SPACE_SPEED: ['speed', 'margins_speed', 'eco_speed'],
  SPACE_GRADIENT: ['slopesCurve'],
  REGIME: ['head_positions', 'tail_positions', 'speeds'],
} as const;

export type ListValues = ValueOf<typeof LIST_VALUES>;
export type AllListValues = ArrayElement<ListValues>;

export const TAG_COLORS = {
  MISSING: '#94918E',
  GIVEN_TRAIN: '#494641',
  FALLBACK: '#216482',
  INCOMPATIBLE: '#EAA72B',
};
