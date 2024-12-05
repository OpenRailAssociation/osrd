import type { TrainSpaceTimeData } from 'applications/operationalStudies/types';
import type { STDCM_REQUEST_STATUS } from 'applications/stdcm/consts';
import type {
  GeoJsonPoint,
  Conflict,
  LightRollingStock,
  PathfindingResultSuccess,
  PostTimetableByIdStdcmApiResponse,
  RollingStockWithLiveries,
  SimulationResponse,
  TowedRollingStock,
  PathProperties,
} from 'common/api/osrdEditoastApi';
import type { SpeedSpaceChartData } from 'modules/simulationResult/types';
import type { SuggestedOP } from 'modules/trainschedule/components/ManageTrainSchedule/types';
import type { StdcmPathStep } from 'reducers/osrdconf/types';
import type { ValueOf } from 'utils/types';

export type StdcmRequestStatus = ValueOf<typeof STDCM_REQUEST_STATUS>;

export type StdcmSuccessResponse = Omit<
  Extract<PostTimetableByIdStdcmApiResponse, { status: 'success' }>,
  'simulation'
> & {
  simulation: Extract<SimulationResponse, { status: 'success' }>;
  rollingStock: LightRollingStock;
  creationDate: Date;
  speedLimitByTag?: string;
  simulationPathSteps: StdcmPathStep[];
};

export type StdcmConflictsResponse = Extract<
  PostTimetableByIdStdcmApiResponse,
  { status: 'conflicts' }
> & {
  rollingStock: LightRollingStock;
  creationDate: Date;
  speedLimitByTag?: string;
  simulationPathSteps: StdcmPathStep[];
  path: PathfindingResultSuccess;
};

export type StdcmResponse = StdcmConflictsResponse | StdcmSuccessResponse;

export type OperationalPoint = NonNullable<PathProperties['operational_points']>[number];

export type StdcmPathProperties = {
  manchetteOperationalPoints?: OperationalPoint[];
  geometry: NonNullable<PathProperties['geometry']>;
  suggestedOperationalPoints: SuggestedOP[];
  zones: NonNullable<PathProperties['zones']>;
};

export type SimulationReportSheetProps = {
  stdcmLinkedTrains: LinkedTrains;
  stdcmData: StdcmSuccessResponse;
  consist: StdcmSimulationInputs['consist'];
  simulationReportSheetNumber: string;
  operationalPointsList: StdcmResultsOperationalPoint[];
  userName?: string;
};

export type StdcmResultsOperationalPoint = {
  opId: string;
  positionOnPath: number;
  time: string | null;
  name?: string;
  ch?: string;
  stop?: string | null;
  duration: number;
  stopEndTime: string;
  trackName?: string;
  stopType?: string;
};

export type ConsistErrors = {
  totalMass?: string;
  totalLength?: string;
  maxSpeed?: string;
};

export type StdcmResults = {
  stdcmResponse: StdcmSuccessResponse;
  speedSpaceChartData: SpeedSpaceChartData | null;
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

export type AllowanceValue =
  | {
      minutes: number;
      value_type: 'time_per_distance';
    }
  | {
      seconds: number;
      value_type: 'time';
    }
  | {
      percentage: number;
      value_type: 'percentage';
    };

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
    speedLimitByTag?: string;
  };
  linkedTrains: LinkedTrains;
};

export type StdcmResultsOutput = {
  pathProperties: StdcmPathProperties;
  results: StdcmSuccessResponse;
  speedSpaceChartData: SpeedSpaceChartData;
};

export type StdcmConflictsOutput = {
  pathProperties: StdcmPathProperties;
  conflicts: Conflict[];
};

export type StdcmSimulationOutputs = StdcmResultsOutput | StdcmConflictsOutput;

export type StdcmSimulation = {
  id: number;
  creationDate: Date;
  inputs: StdcmSimulationInputs;
  outputs?: StdcmSimulationOutputs;
};

/** This type is used for StdcmConsist, StdcmOrigin, StdcmDestination and StdcmVias components */
export type StdcmConfigCardProps = {
  disabled?: boolean;
  consistErrors?: ConsistErrors;
};

export enum ArrivalTimeTypes {
  PRECISE_TIME = 'preciseTime',
  ASAP = 'asSoonAsPossible',
  RESPECT_DESTINATION_SCHEDULE = 'respectDestinationSchedule',
}

export enum StdcmConfigErrorTypes {
  INFRA_NOT_LOADED = 'infraNotLoaded',
  MISSING_LOCATION = 'missingLocation',
  PATHFINDING_FAILED = 'pathfindingFailed',
  BOTH_POINT_SCHEDULED = 'bothPointAreScheduled',
  NO_SCHEDULED_POINT = 'noScheduledPoint',
  ZERO_LENGTH_PATH = 'zeroLengthPath',
}

export type StdcmConfigErrors = {
  errorType: StdcmConfigErrorTypes;
  errorDetails?: { originTime: string; destinationTime: string };
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
