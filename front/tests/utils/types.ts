import type { Tags } from 'common/api/osrdEditoastApi';

// STDCM simulation pdf content type
export type Simulation = {
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
};

export type ProjectData = {
  name: string;
  description: string;
  objectives: string;
  funders: string;
  budget: string;
  tags: Tags;
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

export type ScenarioData = {
  name: string;
  description: string;
  tags: Tags;
};
