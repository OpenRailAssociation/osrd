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

export type ReportTrainData = {
  position: number;
  speed: number;
  time: number;
};

export type AreaBlock = {
  position: number;
  value0: number;
  value1: number;
};

// TODO: remove this when spaceCurvesSlopes chart will be deleted
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
