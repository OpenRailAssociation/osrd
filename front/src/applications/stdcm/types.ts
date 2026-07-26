import type { STDCM_REQUEST_STATUS } from 'applications/stdcm/consts';
import type {
  GeoJsonPoint,
  Conflict,
  LightRollingStock,
  LightRollingStockWithLiveries,
  TowedRollingStock,
  PathProperties,
  LoadingGaugeType,
  StdcmResponseWithTraceId,
} from 'common/api/osrdEditoastApi';
import type {
  PathWaypoint,
  SpeedDistanceDiagramData,
  TrainSpaceTimeData,
} from 'modules/simulationResult/types';
import type { SuggestedOP } from 'modules/trainSchedule/types';
import type { StdcmPathStep } from 'reducers/osrdconf/types';
import type { Duration } from 'utils/duration';
import type { ValueOf } from 'utils/types';

export type StdcmRequestStatus = ValueOf<typeof STDCM_REQUEST_STATUS>;

export type StdcmSuccessResponse = Extract<StdcmResponseWithTraceId, { status: 'success' }> & {
  rollingStock: LightRollingStock;
  creationDate: Date;
  speedLimitByTag?: string;
  simulationPathSteps: StdcmPathStep[];
  alternativePath?: 'upstream' | 'downstream';
};

export type StdcmPathNotFound = Extract<StdcmResponseWithTraceId, { status: 'path_not_found' }>;

export type StdcmResponse = StdcmPathNotFound | StdcmSuccessResponse;

export type StdcmPathProperties = PathProperties & {
  manchetteOperationalPoints?: PathWaypoint[];
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
  time: Duration;
  name?: string;
  consistChange?: ConsistData;
  secondaryCode?: string | null;
  stopDuration: Duration | null;
  stopEndTime: Duration;
  trackName?: string;
  stopType?: StdcmStopTypes;
  stopRequested: boolean;
  weight: number | null;
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
  consist: {
    tractionEngine?: LightRollingStockWithLiveries;
    towedRollingStock?: TowedRollingStock;
    /** In ton */
    totalMass?: number;
    /** In meters */
    totalLength?: number;
    /** In km/s */
    maxSpeed?: number;
    loadingGauge?: LoadingGaugeType;
    speedLimitByTag?: string;
  };
  linkedTrains: LinkedTrains;
};

export type ConsistData = {
  rollingStockID?: number;
  rollingStockName?: string;
  towedRollingStockID?: number;
  towedRollingStockName?: string;
  /** In ton */
  totalMass?: number;
  /** In meters */
  totalLength?: number;
  /** Loading gauge, max speed and speed limit can only be set on initial consist and cannot be changed */
  /** In km/h */
  maxSpeed?: number;
  loadingGauge?: LoadingGaugeType;
  speedLimitByTag?: string;
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

/* This type is used for StdcmOrigin, StdcmDestination and StdcmVias component */
export type StdcmItineraryProps = {
  disabled?: boolean;
  onItineraryChange: () => void;
};

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
  | 'originCh'
  | 'vias'
  | 'viasCh'
  | 'destination'
  | 'destinationCh'
  | 'viaConsistTotalMass'
  | 'viaConsistTotalLength';

export type InvalidFields = {
  fieldName: 'totalMass' | 'totalLength' | 'maxSpeed' | 'originDate' | 'destinationDate';
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
  date: Date | undefined;
  hours: number;
  minutes: number;
};

export enum StdcmStopTypes {
  PASSAGE_TIME = 'passageTime',
  DRIVER_SWITCH = 'driverSwitch',
  SERVICE_STOP = 'serviceStop',
  OVERTAKE = 'overtake',
  CONSIST_CHANGE = 'consistChange',
  BACKTRACK = 'backtrack',
}

export type StdcmLinkedTrainExtremity = {
  secondary_code: string;
  date: string;
  geographic?: GeoJsonPoint | null;
  arrivalDate: Date;
  name: string;
  obj_id: string;
  time: string;
  main_code: string;
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

export type StdcmProgressPoint = {
  type: 'normal' | 'downstream' | 'upstream';
  geoPoint: GeoJsonPoint;
  // When the animation for this point should start
  animationStartTime: number;
};
export type StdcmProgressPoints = StdcmProgressPoint[];
