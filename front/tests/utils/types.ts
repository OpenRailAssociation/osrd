import type {
  PacedTrainException,
  Tags,
  TrainScheduleExceptionChangeGroups,
} from 'common/api/osrdEditoastApi';

type StationRequest = {
  name: string;
  ch: string;
  arrivalTime?: string | null;
  plusTolerance?: string | null;
  minusTolerance?: string | null;
  stop?: string | null;
  departureTime?: string | null;
  reason: string;
};

type StationDetail = {
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
    loadingGauge: string;
    loadingGaugeValue: string;
  };
  requestedRoute: {
    station1: StationRequest;
    station2: StationRequest;
    station3: StationRequest;
  };
  simulationDetails: {
    totalDistance: string;
    simulationRoute: {
      station1: StationDetail;
      station2: StationDetail;
      station3: StationDetail;
      station4: StationDetail;
    };
    disclaimer: string;
  };
};

export type PdfConsistChangeContent = {
  simulationTableLabel: string;
  simulationTableContent: string[];
  sectionHeader: string;
  changes: string;
  massList: string[];
  lengthList: string[];
  rollingStockList: string[];
  towedRollingStockList: string[];
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
  tags?: string[];
  infraName?: string;
  electricProfileName?: string;
};

// Define type for table cell data
export type CellData = {
  stationName: string;
  header: string;
  value: string;
  marginForm?: string;
};

export type PacedTrainDetails = {
  name: string;
  startTime: string;
  labels: string[];
  timeWindow: string;
  interval: string;
  expectedOccurrencesCount: number;
};

export type OccurrenceDetails = {
  name: string;
  startTime: string;
  arrivalTime: string;
  rollingStock?: string;
};

export type OccurrenceMenuButton = 'delete' | 'disable' | 'edit' | 'enable' | 'project' | 'restore';

export type StdcmTranslations = {
  consist: {
    tractionEngine: string;
    towedRollingStock: string;
    compositionCode: string;
    consistChange: string;
    loadingGauge: string;
    tonnage: string;
    length: string;
    maxSpeed: string;
  };
  reportSheet: {
    consistChange: string;
    weight: string;
    length: string;
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
    stopType: {
      consistChange: string;
    };
  };
  departureTime: string;
  simulation: {
    results: {
      simulationName: {
        withoutOutputs: string;
      };
      status: {
        completed: string;
      };
    };
  };
  stdcmErrors: {
    noScheduledPoint: string;
    invalidFields: {
      totalMass: string;
      totalLength: string;
      maxSpeed: string;
    };
    missingFields: {
      tractionEngine: string;
      totalMass: string;
      totalLength: string;
      maxSpeed: string;
      origin: string;
      vias: string;
      destination: string;
      viaConsistTotalMass: string;
      viaConsistTotalLength: string;
    };
    routeErrors: {
      bothPointAreScheduled: string;
      global: string;
      noScheduledPoint: string;
      viaStopDurationMissing: string;
      viaStopDurationDriverSwitchTooShort: string;
      zeroLengthPath: string;
    };
  };
};

export type FlatTranslations = Record<string, string>;

export type StudyFrTranslations = {
  study: {
    studyCategories: FlatTranslations;
    studyStates: FlatTranslations;
  };
};

export type ManageTrainScheduleTranslations = FlatTranslations & {
  pacedTrains: FlatTranslations;
};

export type RoundTripsModalTranslations = FlatTranslations & {
  roundTripsModal: FlatTranslations;
};

export type SimulationResultsTranslations = FlatTranslations & {
  waypointMenu: FlatTranslations;
};

export type TimetableFilterTranslations = FlatTranslations & {
  timetable: FlatTranslations & {
    occurrenceType: FlatTranslations;
    occurrenceChangeGroup: FlatTranslations;
    invalid: FlatTranslations;
  };
  occurrenceMenu: FlatTranslations;
};

export type CommonTranslations = FlatTranslations & {
  common: FlatTranslations;
  timeStopTable: FlatTranslations;
};

export type ChangeGroup =
  | 'constraint_distribution'
  | 'initial_speed'
  | 'labels'
  | 'options'
  | 'path_and_schedule'
  | 'rolling_stock'
  | 'rolling_stock_category'
  | 'speed_limit_tag'
  | 'start_time'
  | 'train_name';

export type RoundTripCardExpected = {
  title: string;
  interval: string;
  stops: string;
  origin: string;
  destination: string;
  startTime: string;
  requestedArrivalTime: string;
};

export type PacedTrainOptions = {
  copyTranslation?: string;
  occurrenceData?: OccurrenceDetails[];
  pacedTrainCardAlreadyOpen?: boolean;
  occurrenceColor?: string;
};

export type ExceptionFormat =
  | PacedTrainException
  | {
      change_groups: TrainScheduleExceptionChangeGroups;
      disabled?: boolean;
      occurrence_index?: number;
    };
