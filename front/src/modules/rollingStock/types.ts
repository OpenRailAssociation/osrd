import type {
  EffortCurveConditions,
  LoadingGaugeType,
  RollingStockComfortType,
  RollingStockCommon,
} from 'common/api/osrdEditoastApi';

export type RollingStockParametersValidValues = {
  // TODO: remove this line in the type
  [key: string]:
    | string
    | number
    | null
    | RollingStockCommon['power_restrictions']
    | string[]
    | MultiUnitsParameter;
  railjsonVersion: string;
  name: string;
  detail: string;
  family: string;
  grouping: string;
  number: string;
  reference: string;
  series: string;
  subseries: string;
  type: string;
  unit: string;
  length: number;
  mass: MultiUnitsParameter;
  maxSpeed: MultiUnitsParameter;
  startupTime: number;
  startupAcceleration: number;
  comfortAcceleration: number;
  gammaValue: number;
  inertiaCoefficient: number;
  loadingGauge: LoadingGaugeType;
  rollingResistanceA: MultiUnitsParameter;
  rollingResistanceB: MultiUnitsParameter;
  rollingResistanceC: MultiUnitsParameter;
  electricalPowerStartupTime: number | null;
  raisePantographTime: number | null;
  basePowerClass: string | null;
  powerRestrictions: RollingStockCommon['power_restrictions'];
  supportedSignalingSystems: string[];
};

export type RollingStockParametersValues = {
  // TODO: remove this line in the type
  [key: string]:
    | string
    | number
    | null
    | RollingStockCommon['power_restrictions']
    | undefined
    | string[]
    | MultiUnitsParameter;
  railjsonVersion: string;
  name: string;
  detail: string;
  family: string;
  grouping: string;
  number: string;
  reference: string;
  series: string;
  subseries: string;
  type: string;
  unit: string;
  length?: number;
  mass?: MultiUnitsParameter;
  maxSpeed?: MultiUnitsParameter;
  startupTime?: number;
  startupAcceleration?: number;
  comfortAcceleration?: number;
  gammaValue?: number;
  inertiaCoefficient?: number;
  loadingGauge: 'G1' | 'G2' | 'GA' | 'GB' | 'GB1' | 'GC' | 'FR3.3' | 'FR3.3/GB/G2' | 'GLOTT';
  rollingResistanceA?: MultiUnitsParameter;
  rollingResistanceB?: MultiUnitsParameter;
  rollingResistanceC?: MultiUnitsParameter;
  electricalPowerStartupTime: number | null;
  raisePantographTime: number | null;
  basePowerClass: string | null;
  powerRestrictions: RollingStockCommon['power_restrictions'];
  supportedSignalingSystems: string[];
};

export type SchemaProperty = {
  title: string;
  type: string;
  side: string;
  format?: string;
  enum?: string[];
  min?: number;
  max?: number;
  unit?: string;
  units?: string[];
  condition?: (effortCurves: EffortCurveForms | null) => boolean;
  margin?: string;
};

export type ElectricalProfileByMode = {
  '1500V': (string | null)[];
  '25000V': (string | null)[];
  other: null[];
  thermal: null[];
};

// Effort curve with values number or undefined
export type EffortCurveForm = {
  max_efforts: Array<number | undefined>;
  speeds: Array<number | undefined>;
};

export type ConditionalEffortCurveForm = {
  cond: EffortCurveConditions;
  curve: EffortCurveForm;
};

export type EffortCurveForms = Record<
  string,
  {
    curves: ConditionalEffortCurveForm[];
    default_curve: EffortCurveForm;
    is_electric: boolean;
  }
>;

export type RollingStockSelectorParams = {
  comfortLevels: RollingStockComfortType[];
  electricalProfiles: (string | null)[];
  powerRestrictions: (string | null)[];
  tractionModes: string[];
};

export type ElectricalParamsLists = Omit<
  RollingStockSelectorParams,
  'comfortLevels' | 'tractionModes'
>;

export type TransformedCurves = {
  [index: string]: {
    mode: string;
    comfort: RollingStockComfortType;
    speeds: number[];
    max_efforts: number[];
    electricalProfile: string | null;
    powerRestriction: string | null;
  };
};

export type ParsedCurve = {
  color: string;
  comfort: RollingStockComfortType;
  data: {
    x: number;
    y: number;
  }[];
  id: string;
  mode: string;
  electrical_profile_level?: string | null;
  power_restriction?: string | null;
};

export type MultiUnitsParameter = {
  min?: number;
  max?: number;
  unit: string;
  value: number;
};
