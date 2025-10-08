import type {
  EffortCurveConditions,
  LoadingGaugeType,
  Comfort,
  RollingStock,
  TrainMainCategory,
  EtcsBrakeParams,
} from 'common/api/osrdEditoastApi';
import type { MultiUnitsParameter, MultiUnit } from 'modules/rollingStock/types';

export type RollingStockParametersValidValues = {
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
  constGamma: number;
  inertiaCoefficient: number;
  loadingGauge: LoadingGaugeType;
  rollingResistanceA: MultiUnitsParameter;
  rollingResistanceB: MultiUnitsParameter;
  rollingResistanceC: MultiUnitsParameter;
  electricalPowerStartupTime: number | null;
  raisePantographTime: number | null;
  basePowerClass: string | null;
  powerRestrictions: RollingStock['power_restrictions'];
  supportedSignalingSystems: string[];
  primaryCategory: TrainMainCategory;
  categories: Set<TrainMainCategory>;
};

export type RollingStockParametersValues = {
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
  constGamma?: number;
  inertiaCoefficient?: number;
  loadingGauge: 'G1' | 'G2' | 'GA' | 'GB' | 'GB1' | 'GC' | 'FR3.3' | 'FR3.3/GB/G2' | 'GLOTT';
  rollingResistanceA?: MultiUnitsParameter;
  rollingResistanceB?: MultiUnitsParameter;
  rollingResistanceC?: MultiUnitsParameter;
  electricalPowerStartupTime: number | null;
  raisePantographTime: number | null;
  basePowerClass: string | null;
  powerRestrictions: RollingStock['power_restrictions'];
  etcsBrakeParams?: EtcsBrakeParams;
  supportedSignalingSystems: string[];
  primaryCategory?: TrainMainCategory;
  categories: Set<TrainMainCategory>;
};

export type SchemaProperty = {
  title: keyof RollingStockParametersValues;
  type: string;
  side: string;
  format?: string;
  enum?: string[];
  min?: number;
  max?: number;
  unit?: string;
  units?: MultiUnit[];
  condition?: (effortCurves: EffortCurveForms | null) => boolean;
  margin?: string;
};

export type ElectricalProfileByMode = {
  '1500V': (string | null)[];
  '25000V': (string | null)[];
  other: null[];
  thermal: null[];
};

export type DataSheetCurve = {
  speed: number | null;
  effort: number | null;
};

// Effort curve with values number or undefined
export type EffortCurveForm = {
  max_efforts: Array<number | null>;
  speeds: Array<number | null>;
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
  comfortLevels: Comfort[];
  electricalProfiles: (string | null)[];
  powerRestrictions: (string | null)[];
  tractionModes: string[];
};

export type ElectricalParamsLists = Omit<
  RollingStockSelectorParams,
  'comfortLevels' | 'tractionModes'
>;
