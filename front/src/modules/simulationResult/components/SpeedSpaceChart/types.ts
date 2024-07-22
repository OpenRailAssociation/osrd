import type { ElectrificationUsageV2 } from 'applications/operationalStudies/types';
import type {
  ElectrificationRange,
  SimulationPowerRestrictionRange,
} from 'common/api/osrdEditoastApi';
import type {
  GradientPosition,
  HeightPosition,
  PositionSpeedTime,
  RadiusPosition,
  SpeedPosition,
} from 'reducers/osrdsimulation/types';

export type ElectricalConditionSegmentV2 = {
  position_start: number;
  position_end: number;
  position_middle: number;
  lastPosition: number;
  height_start: number;
  height_end: number;
  height_middle: number;
  electrification: ElectrificationUsageV2;
  seenRestriction?: string;
  usedRestriction?: string;
  color: string;
  textColor: string;
  text: string;
  isStriped: boolean;
  isIncompatibleElectricalProfile: boolean;
  isRestriction: boolean;
  isIncompatiblePowerRestriction: boolean;
};

export type PowerRestrictionSegment = {
  position_start: number;
  position_end: number;
  position_middle: number;
  lastPosition: number;
  height_start: number;
  height_end: number;
  height_middle: number;
  seenRestriction: string;
  usedRestriction: boolean;
  isStriped: boolean;
  isRestriction: boolean;
  isIncompatiblePowerRestriction: boolean;
};

export type ReportTrainData = {
  position: number;
  speed: number;
  time: number;
};

export type MrspData = {
  position: number;
  speed: number;
};

export type AreaBlock = {
  position: number;
  value0: number;
  value1: number;
};

// TODO DROP V1: remove this
export type GevPreparedData = {
  areaBlock: AreaBlock[];
  areaSlopesHistogram: AreaBlock[];
  curvesHistogram: RadiusPosition[];
  eco_speed: PositionSpeedTime[];
  electrificationRanges: ElectrificationRange[];
  powerRestrictionRanges: SimulationPowerRestrictionRange[];
  margins_speed: PositionSpeedTime[];
  slopesCurve: HeightPosition[];
  slopesHistogram: GradientPosition[];
  speed: PositionSpeedTime[];
  vmax: SpeedPosition[];
};

// TODO DROP V1: remove this
export interface Mode {
  '25000V': AC | string;
  '1500V': DC | string;
  thermal: string;
  '15000V': string;
  '3000V': string;
}

export type ModeV2 = {
  '25000V': AC | string;
  '1500V': DC | string;
  '15000V': string;
  '3000V': string;
};

export type AC = {
  '25000V': string;
  '22500V': string;
  '20000V': string;
};

export type DC = {
  O: string;
  A: string;
  A1: string;
  B: string;
  B1: string;
  C: string;
  D: string;
  E: string;
  F: string;
  G: string;
};
