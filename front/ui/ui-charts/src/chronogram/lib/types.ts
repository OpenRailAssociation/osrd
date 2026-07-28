import type { ChartEventHandlers, TimeChartContextType } from '../../common/types';

export type OccupancyBlock = {
  startTime: number;
  endTime: number;
  trainNames: string[];
};

export type LevelCrossingOccupancies = OccupancyBlock[][];

export type LevelCrossingData = {
  name: string;
  occupancies: LevelCrossingOccupancies;
};

export type ChronogramContextType = TimeChartContextType & {
  levelCrossingsOccupancies: LevelCrossingOccupancies[];
};

export type ChronogramCanvasProps = {
  levelCrossingsOccupancies: LevelCrossingOccupancies[];

  /** The time origin (i.e. the time value for the most left point) */
  timeOrigin: number;
  /** The timescale (in ms/px) */
  timeScale: number;

  // In addition to the time and space origins, it is possible to add offsets (in pixels)
  xOffset?: number;
  yOffset?: number;

  // Custom styles:
} & ChartEventHandlers<ChronogramContextType>;

export type ChronogramProps = {
  levelCrossingData: LevelCrossingData[];
  timeOrigin: number;
  height?: number;
};
