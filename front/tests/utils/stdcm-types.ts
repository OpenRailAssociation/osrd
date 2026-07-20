export type ArrivalType = {
  default: string;
  updated: string;
};

export type ArrivalToleranceFields = {
  negative: string;
  positive: string;
};

export type ToleranceFields = {
  min: string;
  max: string;
};

// ─── Origin ───────────────────────────────────────────────────────────────────

export type DefaultOriginFields = {
  arrivalType: string;
  arrivalDate: string;
  arrivalTime: string;
  tolerance: string;
};

export type ExpectedOriginDetails = {
  originCi: string;
  originCh: string;
  originArrival: string;
  dateOriginArrival: string;
  timeOriginArrival: string;
  toleranceOriginArrival: string;
};

export type OriginDetailsData = {
  input: string;
  expectedCiValue: string;
  suggestionText: string;
  expectedSuggestions: string[];
  chValue: string;
  arrivalDate: string;
  arrivalTime: string;
  tolerance: string;
  updatedChValue: string;
  arrivalType: ArrivalType;
};

export type LightOriginDetailsData = {
  input: string;
  suggestionText: string;
  chValue: string;
  arrivalDate: string;
  arrivalTime: string;
  tolerance: ArrivalToleranceFields;
  arrivalType: string;
};

// ─── Destination ──────────────────────────────────────────────────────────────

export type DestinationUpdatedDetails = {
  date: string;
  hour: string;
  minute: string;
  timeValue: string;
  tolerance: ArrivalToleranceFields;
};

export type DestinationDetailsData = {
  input: string;
  expectedCiValue: string;
  chValue: string;
  arrivalDate: string;
  arrivalTime: string;
  tolerance: string;
  arrivalType: ArrivalType;
  updatedDetails: DestinationUpdatedDetails;
};

export type LightDestinationDetailsData = {
  input: string;
  expectedCiValue: string;
  chValue: string;
  arrivalType: string;
};

// ─── Via ──────────────────────────────────────────────────────────────────────

export type ViaSearchText = 'mid_west' | 'mid_east' | 'nS';

export type ViaStopTypes = {
  PASSAGE_TIME: string;
  SERVICE_STOP: string;
  DRIVER_SWITCH: string;
  BACKTRACK: string;
};

export type ViaStopTimes = {
  serviceStop: {
    default: string;
    input: string;
  };
  driverSwitch: {
    default: string;
    invalidInput: string;
    validInput: string;
  };
};

export type FillAndVerifyViaDetailsParams = {
  viaNumber: number;
  ciSearchText: ViaSearchText;
  expectedChValue: string;
  stopTypes: ViaStopTypes;
  stopTimes: ViaStopTimes;
  suggestionTextBySearch: Record<ViaSearchText, string>;
  driverSwitchTooShortWarning: string;
};

export type VerifyViaDetailsParams = {
  viaNumber?: number;
  expectedCiValue: string;
  expectedViaType: string;
  expectedStopTime: string;
};

// ─── Consist ──────────────────────────────────────────────────────────────────

export type ConsistFields = {
  tractionEngine: string;
  towedRollingStock?: string;
  tonnage?: string;
  length?: string;
  maxSpeed?: string;
  speedLimitTag?: string;
};

export type EditableConsistFields = {
  tonnage?: string;
  length?: string;
  maxSpeed?: string;
};

export type ConsistChangeFields = {
  tractionEngine: string;
  towedRollingStock?: string;
  tonnage: string;
  length: string;
};

export type ExpectedPrefilledValues = {
  expectedTonnage: string;
  expectedLength: string;
};

export type TowedRollingStockPrefilledValues = {
  tonnage?: string;
  length?: string;
};

export type TowedPrefilledValuesParams = {
  tractionEngineTonnage: string;
  tractionEngineLength: string;
  towedRollingStockTonnage?: string;
  towedRollingStockLength?: string;
};

export type FillAndVerifyConsistDetailsParams = {
  consistFields: ConsistFields;
  defaultMaxSpeed: string;
  tractionEnginePrefilledValues: ExpectedPrefilledValues;
  towedRollingStockPrefilledValues?: TowedRollingStockPrefilledValues;
};

// ─── Linked paths ─────────────────────────────────────────────────────────────

export type LinkedTrainInfo = {
  trainName: string;
  segments: string[][];
};

export type LinkedPathDefaultFields = {
  defaultDate: string;
};

type LinkedPathBaseDetails = {
  trainName: string;
  trainDate: string;
  trainDetails: LinkedTrainInfo[];
  toleranceFields: ToleranceFields;
};

export type AnteriorLinkedPathDetails = LinkedPathBaseDetails & {
  originCi: string;
  originCh: string;
  originArrival: string;
  dateOriginArrival: string;
  timeOriginArrival: string;
  toleranceOriginArrival: string;
};

export type PosteriorLinkedPathDetails = LinkedPathBaseDetails & {
  destinationCi: string;
  destinationCh: string;
  destinationArrival: string;
  dateDestinationArrival: string;
  timeDestinationArrival: string;
  toleranceDestinationArrival: string;
};

// ─── STDCM result table ───────────────────────────────────────────────────────

export type STDCMResultTableRow = {
  index: number;
  operationalPoint: string;
  code: string;
  track: string;
  endStop: string | null;
  passageStop: string | null;
  startStop: string | null;
  weight: string | null;
  refEngine: string | null;
};
