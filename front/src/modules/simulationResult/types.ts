import type { Dispatch, SetStateAction } from 'react';

import type { LayerData, PowerRestrictionValues } from '@osrd-project/ui-charts';

import type {
  PathProjectionResult,
  PathPropertiesFormatted,
} from 'applications/operationalStudies/types';
import type {
  PacedTrainException,
  CoreSignalUpdate,
  PathItemLocation,
  PathProperties,
  RollingStockWithLiveries,
  SimulationResponseSuccess,
  TrainSchedule,
  PathItem,
} from 'common/api/osrdEditoastApi';
import type { TrainScheduleWithDetails } from 'modules/trainSchedule/types';
import type {
  IndexedOccurrenceId,
  OccurrenceId,
  TrainScheduleId,
  TrainId,
} from 'reducers/osrdconf/types';
import type { SelectedTrain, SelectionSource } from 'reducers/simulationResults/types';
import type { ArrayElement } from 'utils/types';

// This alias refers to an operational point, in the context of a given path, from Edistoast:
export type EditoastPathOperationalPoint = NonNullable<
  PathProperties['operational_points']
>[number];

// 1. This type refers to an operational point, modified to carry its own unique ID (waypointId), and
// optionally an actual opId, which can be repeated along a path when a train crosses multiple time
// the same operational point
// 2. Remove the part field as it won't be used anywhere in the app. This avoid us to have to add hardcoded data in it.
export type PathOperationalPoint = Omit<EditoastPathOperationalPoint, 'id' | 'part'> & {
  waypointId: string;
  opId: string | null;
  location: PathItemLocation;
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
  paced?: TrainScheduleWithDetails['paced'] & {
    exceptionProjections: Map<number, BaseTrainProjection>;
  };
} & BaseTrainProjection;

/** Contains an individual projection, either of a unique train or an occurrence */
export type IndividualTrainProjection = {
  name: string;
  departureTime: Date;
} & BaseTrainProjection &
  (
    | { id: TrainScheduleId; type: 'trainSchedule' }
    | {
        id: IndexedOccurrenceId;
        type: 'occurrence';
      }
    | {
        id: OccurrenceId;
        type: 'exception';
        exception: PacedTrainException;
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

/**
 * The five visual states a curve can take in STD/TOD charts. Hover is not
 * part of this union: it is a transverse modifier carried alongside the
 * state (see [[CurveVisualClassification]]).
 */
export type CurveVisualState = 'none' | 'active' | 'passivePrimary' | 'passiveSecondary' | 'drag';

/**
 * Output of the curve visual state classifier: the base state and a
 * transverse `hovered` flag set only for the train directly under the cursor.
 */
export type CurveVisualClassification = {
  state: CurveVisualState;
  hovered: boolean;
};

/**
 * Exception types that influence the curve visual state. The values match
 * the keys of `PacedTrainException` so callers can pass them directly.
 */
export type CurveStyleExceptionType = keyof Pick<
  PacedTrainException,
  'start_time' | 'path_and_schedule'
>;

/**
 * Input of the shared curve-style helper.
 */
export type CurveStyleInput = {
  chart: 'std' | 'tod';
  train: {
    id: TrainId;
    exceptionType?: CurveStyleExceptionType;
    isDragging?: boolean;
  };
  selection: SelectedTrain | undefined;
  panelMode?: 'compliant' | 'all' | 'single';
  hover?: {
    trainId: TrainId;
    from: SelectionSource;
    exceptionType?: CurveStyleExceptionType;
  };
};
