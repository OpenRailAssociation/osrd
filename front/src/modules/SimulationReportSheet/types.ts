import type { OperationalPointWithTimeAndSpeed } from 'applications/operationalStudies/types';
import type {
  StdcmResultsOperationalPoint,
  StdcmStopTypes,
  StdcmSuccessResponse,
} from 'applications/stdcm/types';
import type {
  LightRollingStock,
  PathfindingResultSuccess,
  RollingStockWithLiveries,
  SimulationResponseSuccess,
} from 'common/api/osrdEditoastApi';
import type { Duration } from 'utils/duration';

export type SimulationSheetData = {
  trainName?: string;
  rollingStock: RollingStockWithLiveries;
  speedLimitByTag?: string | null;
  departure_time: string;
  creationDate: Date;
  simulation: SimulationResponseSuccess;
};

export type SimulationTableStdcmProps = {
  stdcmData: StdcmSuccessResponse;
  operationalPointsList: StdcmResultsOperationalPoint[];
  rollingStock: LightRollingStock;
  consistMass: number;
  consistLength: number;
};

export type SimulationTableScenarioProps = {
  path: PathfindingResultSuccess;
  operationalPointsList: OperationalPointWithTimeAndSpeed[];
  rollingStock: RollingStockWithLiveries;
};

export type RouteTableRow = {
  name: string;
  secondaryCode: string;
  arrivesAt?: string;
  passageStop?: Duration;
  leavesAt?: string;
  stopType?: StdcmStopTypes;
  tolerances?: { before: Duration; after: Duration };
  italic?: boolean;
};
