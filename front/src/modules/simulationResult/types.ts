import type { Dispatch, SetStateAction } from 'react';

import type { LayerData, PowerRestrictionValues } from '@osrd-project/ui-charts';

import type {
  OperationalPoint,
  PathPropertiesFormatted,
  SimulationResponseSuccess,
} from 'applications/operationalStudies/types';
import type {
  PathProperties,
  PathfindingResultSuccess,
  ProjectPathTrainResult,
  RollingStockWithLiveries,
  TrainSchedule,
} from 'common/api/osrdEditoastApi';
import type { PacedTrainWithDetails } from 'modules/trainschedule/components/Timetable/types';
import type {
  OccurrenceId,
  TimetableItemWithTimetableId,
  TrainScheduleId,
} from 'reducers/osrdconf/types';
import type { ArrayElement } from 'utils/types';

// Space Time Chart
/**
 * Properties signal_updates time_end and time_start are in seconds taking count of the departure time
 */
// TODO: reuse the type from osrd-ui/ui-manchette
export type TrainSpaceTimeData = {
  name: string;
  spaceTimeCurves: {
    positions: number[];
    times: number[];
  }[];
  departureTime: Date;
  signalUpdates: ProjectPathTrainResult['signal_updates'];
} & ({ id: TrainScheduleId } | { id: OccurrenceId; paced: PacedTrainWithDetails['paced'] });

// Speed Space Chart
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
  projectionPath: TrainSchedule['path'];
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
