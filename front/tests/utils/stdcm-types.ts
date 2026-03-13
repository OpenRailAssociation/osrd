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
