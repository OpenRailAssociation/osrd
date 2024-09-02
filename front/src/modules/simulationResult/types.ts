import type {
  LayerData,
  PowerRestrictionValues,
} from '@osrd-project/ui-speedspacechart/dist/types/chartTypes';

import type {
  PathPropertiesFormatted,
  PositionData,
  SimulationResponseSuccess,
} from 'applications/operationalStudies/types';
import type { RollingStockWithLiveries } from 'common/api/osrdEditoastApi';
import type { HeightPosition } from 'reducers/simulationResults/types';
import type { ArrayElement } from 'utils/types';

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

export type SpaceCurvesSlopesData = {
  gradients: number[];
  speed: ReportTrainData[];
  slopesHistogram: PositionData<'gradient'>[];
  areaSlopesHistogram: MergedBlock<'position' | 'gradient'>[];
  slopesCurve: HeightPosition[];
  curvesHistogram: PositionData<'radius'>[];
};

export type SpeedLimitTagValue = ArrayElement<SimulationResponseSuccess['mrsp']['values']>;

export type SpeedSpaceChartData = {
  rollingStock: RollingStockWithLiveries;
  formattedPowerRestrictions: LayerData<PowerRestrictionValues>[] | undefined;
  simulation?: SimulationResponseSuccess;
  formattedPathProperties: PathPropertiesFormatted;
  departureTime: string;
};
