import type { Dispatch, SetStateAction } from 'react';

import type { LayerData, PowerRestrictionValues } from '@osrd-project/ui-charts';

import type {
  OperationalPoint,
  PathPropertiesFormatted,
  SimulationResponseSuccess,
  TrainSpaceTimeData,
} from 'applications/operationalStudies/types';
import type {
  PathProperties,
  PathfindingResultSuccess,
  RollingStockWithLiveries,
  TrainScheduleBase,
} from 'common/api/osrdEditoastApi';
import type { TimetableItemWithTimetableId } from 'reducers/osrdconf/types';
import type { ArrayElement } from 'utils/types';

export type SpeedLimitTagValue = ArrayElement<SimulationResponseSuccess['mrsp']['values']>;

export type SpeedSpaceChartData = {
  rollingStock: RollingStockWithLiveries;
  formattedPowerRestrictions: LayerData<PowerRestrictionValues>[] | undefined;
  simulation?: SimulationResponseSuccess;
  formattedPathProperties: PathPropertiesFormatted;
  departureTime: string;
};

export type ProjectionData = {
  trainSchedule: TimetableItemWithTimetableId;
  projectedTrains: TrainSpaceTimeData[];
  path: PathfindingResultSuccess;
  geometry: PathProperties['geometry'];
  projectionLoaderData: {
    allTrainsProjected: boolean;
    totalTrains: number;
  };
};

export type WaypointsPanelData = {
  timetableId: number | undefined;
  filteredWaypoints: OperationalPoint[];
  setFilteredWaypoints: Dispatch<SetStateAction<OperationalPoint[]>>;
  projectionPath: TrainScheduleBase['path'];
};

export type LayerRangeData = {
  spaceStart: number;
  spaceEnd: number;
  timeStart: number;
  timeEnd: number;
};

export type AspectLabel =
  | 'VL'
  | '300VL'
  | 'S'
  | 'OCCUPIED'
  | 'C'
  | 'RRR'
  | '(A)'
  | 'A'
  | '300(VL)'
  | '270A'
  | '220A'
  | '160A'
  | '080A'
  | '000';
