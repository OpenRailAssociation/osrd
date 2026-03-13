export type ArrivalType = {
  default: string;
  updated: string;
};

export type ArrivalToleranceFields = {
  negative: string;
  positive: string;
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
