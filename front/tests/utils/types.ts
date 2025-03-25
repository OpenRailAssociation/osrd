import type { Tags } from 'common/api/osrdEditoastApi';

export type PdfSimulationContent = {
  header: {
    toolDescription: string;
    documentTitle: string;
  };
  applicationDate: string;
  applicationDateValue: string;
  trainDetails: {
    compositionCode: string;
    compositionCodeValue: string;
    towedMaterial: string;
    towedMaterialValue: string;
    maxSpeed: string;
    maxSpeedValue: string;
    maxTonnage: string;
    maxTonnageValue: string;
    referenceEngine: string;
    referenceEngineValue: string;
    maxLength: string;
    maxLengthValue: string;
  };
  requestedRoute: {
    station1: {
      name: string;
      ch: string;
      arrivalTime?: string | null;
      plusTolerance?: string | null;
      minusTolerance?: string | null;
      stop?: string | null;
      departureTime?: string | null;
      reason: string;
    };
    station2: {
      name: string;
      ch: string;
      arrivalTime?: string | null;
      plusTolerance?: string | null;
      minusTolerance?: string | null;
      stop?: string | null;
      departureTime?: string | null;
      reason: string;
    };
    station3: {
      name: string;
      ch: string;
      arrivalTime?: string | null;
      plusTolerance?: string | null;
      minusTolerance?: string | null;
      stop?: string | null;
      departureTime?: string | null;
      reason: string;
    };
  };
  simulationDetails: {
    totalDistance: string;
    simulationRoute: {
      station1: {
        name: string;
        ch: string;
        track: string;
        arrivalTime?: string | null;
        passageTime?: string | null;
        departureTime?: string | null;
        tonnage: string;
        length: string;
        referenceEngine?: string | null;
        stopType?: string | null;
      };
      station2: {
        name: string;
        ch: string;
        track: string;
        arrivalTime?: string | null;
        passageTime?: string | null;
        departureTime?: string | null;
        tonnage: string;
        length: string;
        referenceEngine?: string | null;
        stopType?: string | null;
      };
      station3: {
        name: string;
        ch: string;
        track: string;
        arrivalTime?: string | null;
        passageTime?: string | null;
        departureTime?: string | null;
        tonnage: string;
        length: string;
        referenceEngine?: string | null;
        stopType?: string | null;
      };
      station4: {
        name: string;
        ch: string;
        track: string;
        arrivalTime?: string | null;
        passageTime?: string | null;
        departureTime?: string | null;
        tonnage: string;
        length: string;
        referenceEngine?: string | null;
        stopType?: string | null;
      };
      station5: {
        name: string;
        ch: string;
        track: string;
        arrivalTime?: string | null;
        passageTime?: string | null;
        departureTime?: string | null;
        tonnage: string;
        length: string;
        referenceEngine?: string | null;
        stopType?: string | null;
      };
    };
    disclaimer: string;
  };
};

// STDCM consist block type
export type ConsistFields = {
  tractionEngine: string;
  towedRollingStock?: string;
  tonnage?: string;
  length?: string;
  maxSpeed?: string;
  speedLimitTag?: string;
};

type Margin = {
  theoretical: string;
  theoreticalS: string;
  actual: string;
  difference: string;
};

// STDCM simulation table type
export type StationData = {
  stationName: string;
  stationCh: string;
  trackName: string;
  requestedArrival: string;
  requestedDeparture: string;
  stopTime: string;
  signalReceptionClosed: boolean;
  shortSlipDistance: boolean;
  margin: Margin;
  calculatedArrival: string;
  calculatedDeparture: string;
};

export type RollingStockDetails = {
  inputs: { id: string; value: string | number; isNumeric?: boolean }[];
  updatedInputs: { id: string; value: string | number; isNumeric?: boolean }[];
  speedEffortData: { velocity: string; effort: string }[];
  speedEffortDataC1: { velocity: string; effort: string }[];
  speedEffortDataUpdated: { velocity: string; effort: string }[];
  additionalDetails: { electricalPowerStartupTime: number; raisePantographTime: number };
  expectedValues: { id: string; value: string | string[]; isTranslated?: boolean }[];
  updatedExpectedValues: { id: string; value: string | string[]; isTranslated?: boolean }[];
};

export type ProjectData = {
  name: string;
  description: string;
  objectives: string;
  funders: string;
  budget: string;
  tags: Tags;
};

export type ProjectDetails = {
  name: string;
  description: string;
  objectives: string;
  funders: string;
  budget: string;
  tags: string[];
};

export type StudyData = {
  actual_end_date: string;
  budget: string;
  business_code: string;
  description: string;
  name: string;
  expected_end_date: string;
  service_code: string;
  start_date: string;
  state: string;
  study_type: string;
  tags: Tags;
};

export type StudyDetails = {
  name: string;
  description: string;
  type: string;
  status: string;
  startDate: string;
  expectedEndDate: string;
  endDate: string;
  serviceCode: string;
  businessCode: string;
  budget: string;
  tags: string[];
};

export type ScenarioData = {
  name: string;
  description: string;
  tags: Tags;
};

export type ScenarioDetails = {
  name: string;
  description: string;
  tags: string[];
  infraName?: string;
  electricProfileName?: string;
};

export type STDCMResultTableRow = {
  index: number;
  operationalPoint: string;
  code: string;
  endStop: string | null;
  passageStop: string | null;
  startStop: string | null;
  weight: string | null;
  refEngine: string | null;
};

// Define interface for table cell data
export interface CellData {
  stationName: string;
  header: string;
  value: string;
  marginForm?: string;
}

export type PacedTrainDetails = {
  name: string;
  startTime: string;
  labels: string[];
  duration: string;
  step: string;
};

export type OccurrenceDetails = {
  name: string;
  startTime: string;
  arrivalTime: string;
};

export type StdcmTranslations = {
  consist: {
    tractionEngine: string;
    compositionCode: string;
    tonnage: string;
    length: string;
    maxSpeed: string;
  };
  mailFeedback: {
    subject: string;
    simulationDetails: string;
    body: string;
    title?: string;
    description?: string;
  };
  trainPath: {
    origin: string;
    destination: string;
    warningMinStopTime?: string;
  };
  departureTime: string;
  simulation: {
    results: {
      simulationName: {
        withoutOutputs: string;
      };
    };
  };
  stdcmErrors: {
    noScheduledPoint: string;
    missingFields: {
      tractionEngine: string;
      totalMass: string;
      totalLength: string;
      maxSpeed: string;
      origin: string;
      destination: string;
    };
  };
};

export type FlatTranslations = Record<string, string>;

export type ManageTrainScheduleTranslations = FlatTranslations & {
  pacedTrains: FlatTranslations;
};

export type TimetableFilterTranslations = FlatTranslations & {
  timetable: FlatTranslations;
};

export type CommonTranslations = FlatTranslations & {
  common: FlatTranslations;
};
