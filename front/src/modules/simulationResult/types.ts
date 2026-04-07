import type { Dispatch, SetStateAction } from 'react';

import type { LayerData, PowerRestrictionValues } from '@osrd-project/ui-charts';

import type {
  PathProjectionResult,
  PathPropertiesFormatted,
} from 'applications/operationalStudies/types';
import type {
  PacedTrainException,
  CoreSignalUpdate,
  PathProperties,
  RollingStockWithLiveries,
  SimulationResponseSuccess,
  TrainSchedule,
  PathItem,
} from 'common/api/osrdEditoastApi';
import type { PacedTrainWithDetails } from 'modules/timetableItem/types';
import type { OccurrenceId, PacedTrainId } from 'reducers/osrdconf/types';
import type { ArrayElement } from 'utils/types';

// This alias refers to an operational point, in the context of a given path, from Edistoast:
export type EditoastPathOperationalPoint = NonNullable<
  PathProperties['operational_points']
>[number];

// This type refers to an operational point, modified to carry its own unique ID (waypointId), and
// optionally an actual opId, which can be repeated along a path when a train crosses multiple time
// the same operational point:
export type PathOperationalPoint = Omit<EditoastPathOperationalPoint, 'id'> & {
  waypointId: string;
  opId: string | null;
};

// Space Time Chart
/**
 * Properties signal_updates time_end and time_start are in seconds taking count of the departure time
 */
export type BaseTrainProjection = {
  spaceTimeCurves: {
    positions: number[];
    times: number[];
  }[];
  signalUpdates: CoreSignalUpdate[];
  isSimulated?: boolean;
};

export type TrainSpaceTimeData = {
  id: number;
  name: string;
  departureTime: Date;
  originPathItem: PathItem;
  destinationPathItem: PathItem;
  paced?: PacedTrainWithDetails['paced'] & {
    exceptionProjections: Map<number, BaseTrainProjection>;
  };
} & BaseTrainProjection;

/** Contains an individual projection, either of a unique train or an occurrence */
export type IndividualTrainProjection = {
  name: string;
  departureTime: Date;
} & BaseTrainProjection &
  (
    | { id: PacedTrainId }
    | {
        id: OccurrenceId;
        exception?: PacedTrainException;
      }
  );

// Speed Space Chart
export type SpeedLimitTagValue = ArrayElement<SimulationResponseSuccess['mrsp']['values']>;

export type SpeedDistanceDiagramData = {
  rollingStock: RollingStockWithLiveries;
  formattedPowerRestrictions: LayerData<PowerRestrictionValues>[] | undefined;
  simulation?: SimulationResponseSuccess;
  formattedPathProperties: PathPropertiesFormatted;
};

export type ProjectionData = Omit<
  PathProjectionResult,
  'operationalPointDistances' | 'operationalPointPartReferences'
> & {
  projectedTrains: TrainSpaceTimeData[];
  projectionLoaderData: {
    allTrainsProjected: boolean;
    totalTrains: number;
  };
};

export type WaypointsPanelData = {
  timetableId: number | undefined;
  filteredWaypoints: PathOperationalPoint[];
  setFilteredWaypoints: Dispatch<SetStateAction<PathOperationalPoint[]>>;
  deployedWaypoints: Set<string>;
  toggleDeployedWaypoint: (waypointId: string, deployed?: boolean) => void;
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

export type DraggingState = {
  draggedTrain: IndividualTrainProjection;
  initialDepartureTime: Date;
};
