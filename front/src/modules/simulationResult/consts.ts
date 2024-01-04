import { ArrayElement, ObjectFieldsTypes } from 'utils/types';

// CHARTS
export const TIME = 'time';
export const POSITION = 'position';
export const SPEED = 'speed';
export const GRADIENT = 'gradient';
export const RADIUS = 'radius';
export const HEIGHT = 'height';

export type AxisKey = 'time' | 'position' | 'speed' | 'gradient' | 'radius' | 'height';

export const CHART_AXES = {
  SPACE_TIME: [TIME, POSITION],
  SPACE_SPEED: [POSITION, SPEED],
  SPACE_GRADIENT: [POSITION, GRADIENT],
  SPACE_RADIUS: [POSITION, RADIUS],
  SPACE_HEIGHT: [POSITION, HEIGHT],
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

export type PositionScaleDomain = {
  initial: number[];
  current: number[];
  source?: 'SpeedSpaceChart' | 'SpaceCurvesSlopes';
};
