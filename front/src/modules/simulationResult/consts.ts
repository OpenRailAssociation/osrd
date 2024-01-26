import { ArrayElement, ObjectFieldsTypes } from 'utils/types';

// CHARTS

export const CHART_AXES = {
  SPACE_TIME: ['time', 'position'],
  SPACE_SPEED: ['position', 'speed'],
  SPACE_GRADIENT: ['position', 'gradient'],
  SPACE_RADIUS: ['position', 'radius'],
  SPACE_HEIGHT: ['position', 'height'],
} as const;

export type ChartAxes = ObjectFieldsTypes<typeof CHART_AXES>;
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

export type ListValues = ObjectFieldsTypes<typeof LIST_VALUES>;
export type AllListValues = ArrayElement<ListValues>;

// Signal Base is the Signaling system chosen for results display
export const SIGNAL_BASE_DEFAULT = 'BAL3';

export const LIST_VALUES_SIGNAL_BASE = ['BAL3'];
