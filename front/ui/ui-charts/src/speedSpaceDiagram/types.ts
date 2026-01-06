import type { BaseChartContextType } from '../common/types';

export type SpeedSpaceDiagramContextType = BaseChartContextType & {
  width: number;
  height: number;

  // Scales:
  speedScale: number;
  spaceOrigin: number;
  spaceScale: number;
};
