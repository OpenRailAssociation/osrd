import { type HTMLProps } from 'react';

import type { TimeChartContextType } from '../../common/types';
import type { SpaceTimeChartTheme } from '../../spaceTimeChart';

export type OccupancyBlock = {
  startTime: number;
  endTime: number;
};

export type LevelCrossingOccupancies = OccupancyBlock[][];

export type ChronogramContextType = TimeChartContextType & {
  levelCrossingsNames: string[];
  levelCrossingsOccupancies: LevelCrossingOccupancies[];
};

export type ChronogramProps = {
  levelCrossingsNames: string[];
  levelCrossingsOccupancies: LevelCrossingOccupancies[];

  // The time origin (i.e. the time value for the most left point)
  timeOrigin: number;
  // The timescale (in ms/px)
  timeScale: number;

  // In addition to the time and space origins, it is possible to add offsets (in pixels)
  xOffset?: number;
  yOffset?: number;

  // Custom styles:
  theme?: Partial<SpaceTimeChartTheme>;
  // TODO: Replace HTMLProps with ChartEventHandlers<ChronogramContextType> when we implement mouse interactions
} & HTMLProps<HTMLDivElement>;
