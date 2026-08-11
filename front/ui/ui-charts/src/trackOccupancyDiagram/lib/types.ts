import type { CurveStyle, PickingElement } from '../../common/types';
import { type TICKS_PATTERN } from './consts';

export type Track = {
  id: string;
  name?: string;
  line?: string;
};

export type OccupancyZone = {
  pathId: string;
  trackId: string;
  trainName: string;
  originStation?: string;
  destinationStation?: string;
  startTime: number;
  endTime: number;
  startDirection?: 'up' | 'down';
  endDirection?: 'up' | 'down';
  trailingText?: string;
  curveStyle: CurveStyle;
  connectorStyle?: { width?: number; color?: string };
};

export type OccupancyZonePickingElement = PickingElement & {
  type: 'occupancyZone';
  pathId: string;
};

/**
 * Shades of the color of the train departing after the linking, from the lightest to the darkest.
 * Which one is used where depends on the state of the linking being drawn.
 */
export type LinkingColors = {
  /** Line under the dashes, when the linking is hovered */
  surface: string;
  /** Capsule outline, and line under the dashes at rest */
  soft: string;
  /** Capsule border, and dashes at rest */
  base: string;
  /** Dashes, when the linking is hovered */
  strong: string;
};

export type Linking = {
  id: string;
  trackId: string;
  colors: LinkingColors;
  startTime: number;
  endTime: number;
  suggested?: boolean;
  hover?: boolean;
};

export type BrokenLinking = {
  id: string;
  trackId: string;
  direction: 'forward' | 'backward';
  time: number;
  name: string;
};

export type LinkingPickingElement = PickingElement & {
  type: 'linking';
  linkingId: string;
};

export type BrokenLinkingPickingElement = PickingElement & {
  type: 'brokenLinking';
  brokenLinkingId: string;
  direction: BrokenLinking['direction'];
};

export type TickPattern = keyof typeof TICKS_PATTERN;
