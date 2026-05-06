import type { Style } from '@react-pdf/types';

import type { StdcmStopTypes } from 'applications/stdcm/types';
import type {
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

export type ConsistChangeData = {
  name: string;
  secondaryCode: string;
  totalMass: string;
  totalLength: string;
  rollingStockName: string;
  towedRollingStockName?: string;
};

export type SimulationTableRow = {
  name: string | null;
  secondaryCode?: string | null;
  trackName?: string;
  endTime: string | Date | null;
  passageStop: string | Date | null;
  startTime: string | Date | null;
  weight: string;
  length: string;
  referenceEngine: string;
  stopTypeLabel?: string;
  stopType?: string;
  rowStyle: Style;
  consistChanges?: {
    currentConsist: {
      totalMass: string;
      totalLength: string;
    };
    updatedConsist: {
      totalMass: string;
      totalLength: string;
      rollingStockName: string;
      towedRollingStockName?: string;
    };
  };
  stylesByColumn: {
    index: Style;
    name: Style;
    secondaryCode: Style;
    trackName?: Style;
    passageStop: Style;
    others: Style;
  };
};
