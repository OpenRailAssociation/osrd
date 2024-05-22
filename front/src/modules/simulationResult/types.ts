import type { PositionData } from 'applications/operationalStudies/types';
import type { HeightPosition } from 'reducers/osrdsimulation/types';

import type { MergedBlock } from './components/ChartHelpers/ChartHelpers';
import type { ReportTrainData } from './components/SpeedSpaceChart/types';

export type PositionScaleDomain = {
  initial: number[];
  current: number[];
  source?: 'SpeedSpaceChart' | 'SpaceCurvesSlopes';
};

export type TimeScaleDomain = {
  range?: [Date, Date];
  source?: 'SpaceTimeChart' | 'Timeline';
};

export type SpaceCurvesSlopesDataV2 = {
  gradients: number[];
  speed: ReportTrainData[];
  slopesHistogram: PositionData<'gradient'>[];
  areaSlopesHistogram: MergedBlock<'position' | 'gradient'>[];
  slopesCurve: HeightPosition[];
  curvesHistogram: PositionData<'radius'>[];
};
