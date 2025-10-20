import type { STDCM_REQUEST_STATUS } from 'applications/stdcm/consts';
import type {
  GeoJsonPoint,
  Conflict,
  LightRollingStock,
  PostTimetableByIdStdcmApiResponse,
  RollingStockWithLiveries,
  TowedRollingStock,
  PathProperties,
  LoadingGaugeType,
} from 'common/api/osrdEditoastApi';
import type {
  PathOperationalPoint,
  SpeedDistanceDiagramData,
  TrainSpaceTimeData,
} from 'modules/simulationResult/types';
import type { SuggestedOP } from 'modules/timetableItem/types';
import type { StdcmPathStep } from 'reducers/osrdconf/types';
import type { Duration } from 'utils/duration';
import type { ValueOf } from 'utils/types';

export type StdcmRequestStatus = ValueOf<typeof STDCM_REQUEST_STATUS>;

export type StdcmSuccessResponse = Extract<
  PostTimetableByIdStdcmApiResponse,
  { status: 'success' }
> & {
  rollingStock: LightRollingStock;
  creationDate: Date;
  speedLimitByTag?: string;
  simulationPathSteps: StdcmPathStep[];
  alternativePath?: 'upstream' | 'downstream';
};

export type StdcmPathNotFound = Extract<
  PostTimetableByIdStdcmApiResponse,
  { status: 'path_not_found' }
>;

export type StdcmResponse = StdcmPathNotFound | StdcmSuccessResponse;

export type StdcmPathProperties = PathProperties & {
  manchetteOperationalPoints?: PathOperationalPoint[];
  suggestedOperationalPoints: SuggestedOP[];
};

type WaypointWithSecondaryCode = {
  name: string;
  secondary_code?: string | null;
};

export type SimilarTrainWithSecondaryCode = {
  train_name: string | null;
  start_time?: Date;
  begin: WaypointWithSecondaryCode;
  end: WaypointWithSecondaryCode;
};

export type StdcmResultsOperationalPoint = {
  opId?: string;
  positionOnPath: number;
  time: string | null;
  name?: string;
  ch?: string;
  duration: Duration | null;
  stopEndTime: string;
  trackName?: string;
  stopType?: StdcmStopTypes;
  stopRequested: boolean;
};

export type FieldError = {
  message?: string;
  display: boolean;
  type: 'missing' | 'invalid';
};

export type ConsistErrors = {
  totalMass: FieldError;
  totalLength: FieldError;
  maxSpeed: FieldError;
};

export type StdcmResults = {
  stdcmResponse: StdcmSuccessResponse;
  speedDistanceDiagramData: SpeedDistanceDiagramData | null;
  spaceTimeData: TrainSpaceTimeData[] | null;
};

export type LinkedTrains = {
  anteriorTrain?: {
    date: string;
    time: string;
    trainName: string;
  };
  posteriorTrain?: {
    date: string;
    time: string;
    trainName: string;
  };
};

export enum MarginType {
  PERCENTAGE = 'percentage',
  TIME_PER_DISTANCE = 'time_per_distance',
}

export type StdcmSimulationInputs = {
  departureDate?: string;
  departureTime?: string;
  pathSteps: StdcmPathStep[];
  consist?: {
    tractionEngine?: RollingStockWithLiveries;
    towedRollingStock?: TowedRollingStock;
    /** In ton */
    totalMass?: number;
    /** In meters */
    totalLength?: number;
    /** In km/s */
    maxSpeed?: number;
    loadingGauge: LoadingGaugeType;
    speedLimitByTag?: string;
  };
  linkedTrains: LinkedTrains;
};

export type StdcmResultsOutput = {
  pathProperties: StdcmPathProperties;
  results: StdcmSuccessResponse;
  speedDistanceDiagramData: SpeedDistanceDiagramData;
};

export type StdcmConflictsOutput = {
  pathProperties: StdcmPathProperties;
  conflicts: Conflict[];
};

export type StdcmSimulationOutputs = StdcmResultsOutput | StdcmPathNotFound;

export type StdcmSimulation = {
  index: number;
  creationDate: Date;
  inputs: StdcmSimulationInputs;
  outputs?: StdcmSimulationOutputs;
  alternativePath?: 'upstream' | 'downstream';
};

/** This type is used for StdcmConsist component */
export type StdcmConfigCardProps = {
  disabled?: boolean;
  consistErrors?: ConsistErrors;
  isDebugMode?: boolean;
};

/* This type is used for StdcmOrigin, StdcmDestination and StdcmVias component */
export type StdcmItineraryProps = {
  onItineraryChange: () => void;
} & StdcmConfigCardProps;

export enum ArrivalTimeTypes {
  PRECISE_TIME = 'preciseTime',
  ASAP = 'asSoonAsPossible',
  RESPECT_DESTINATION_SCHEDULE = 'respectDestinationSchedule',
}

export enum StdcmConfigErrorTypes {
  INFRA_NOT_LOADED = 'infraNotLoaded',
  PATHFINDING_FAILED = 'pathfindingFailed',
  BOTH_POINT_SCHEDULED = 'bothPointAreScheduled',
  NO_SCHEDULED_POINT = 'noScheduledPoint',
  ZERO_LENGTH_PATH = 'zeroLengthPath',
  MISSING_INFORMATIONS = 'missingInformations',
  INVALID_FIELDS = 'invalidInformations',
  MULTIPLE_ERRORS = 'multipleErrors',
  VIA_STOP_DURATION_MISSING = 'viaStopDurationMissing',
  VIA_STOP_DURATION_TOO_SHORT = 'viaStopDurationTooShort',
}

export type MissingFields =
  | 'tractionEngine'
  | 'totalMass'
  | 'totalLength'
  | 'maxSpeed'
  | 'origin'
  | 'vias'
  | 'destination';

export type InvalidFields = {
  fieldName: 'totalMass' | 'totalLength' | 'maxSpeed';
};

export type StdcmConfigErrors = {
  errorType: StdcmConfigErrorTypes;
  errorDetails?: {
    routeErrors?: StdcmConfigErrorTypes[];

    originTime?: string;
    destinationTime?: string;
    missingFields?: MissingFields[];
    invalidFields?: InvalidFields[];
  };
};

export type ScheduleConstraint = {
  date: Date;
  hours: number;
  minutes: number;
};

export enum StdcmStopTypes {
  PASSAGE_TIME = 'passageTime',
  DRIVER_SWITCH = 'driverSwitch',
  SERVICE_STOP = 'serviceStop',
  OVERTAKE = 'overtake',
}

export type StdcmLinkedTrainExtremity = {
  ch: string;
  date: string;
  geographic: GeoJsonPoint;
  arrivalDate: Date;
  name: string;
  obj_id: string;
  time: string;
  trigram: string;
  uic: number;
};

export type StdcmLinkedTrainResult = {
  destination: StdcmLinkedTrainExtremity;
  origin: StdcmLinkedTrainExtremity;
  trainName: string;
};

export type ExtremityPathStepType = 'origin' | 'destination';

export type LoaderStatus = {
  status: 'loader-fixed-bottom' | 'loader-fixed-top' | 'loader-absolute';
  firstLaunch: boolean;
};

export type LinkedTrainType = 'anterior' | 'posterior';

export type StdcmSearchDatetimeWindow = {
  begin: Date;
  end: Date;
};
