import { ConditionalEffortCurve, EffortCurve } from 'common/api/osrdEditoastApi';

type EffortCurves = {
  modes: {
    [key: string]: {
      curves: ConditionalEffortCurve[];
      defaultCurve: EffortCurve;
      isElectric: boolean;
    };
  };
};

export type RollingStockParametersValues = {
  [key: string]: string | number | null | EffortCurves;
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
  mass: number;
  maxSpeed: number;
  startupTime: number;
  startupAcceleration: number;
  comfortAcceleration: number;
  gammaValue: number;
  inertiaCoefficient: number;
  loadingGauge: 'G1' | 'G2' | 'GA' | 'GB' | 'GB1' | 'GC' | 'FR3.3' | 'FR3.3/GB/G2' | 'GLOTT';
  rollingResistanceA: number;
  rollingResistanceB: number;
  rollingResistanceC: number;
  electricalPowerStartupTime: number | null;
  raisePantographTime: number | null;
  defaultMode: string;
  effortCurves: EffortCurves;
};

export type SchemaProperty = {
  title: string;
  type: string;
  required: boolean;
  group: string;
  side: string;
  format?: string;
  enum?: string[];
  min?: number;
  max?: number;
  unit?: string;
  units?: string[];
};

export enum Metadata {
  name = 'name',
  detail = 'detail',
  family = 'family',
  grouping = 'grouping',
  number = 'number',
  reference = 'reference',
  series = 'series',
  subseries = 'subseries',
  type = 'type',
  unit = 'unit',
}

export enum Parameter {
  length = 'length',
  mass = 'mass',
  maxSpeed = 'maxSpeed',
  startupTime = 'startupTime',
  startupAcceleration = 'startupAcceleration',
  comfortAcceleration = 'comfortAcceleration',
  gammaValue = 'gammaValue',
  inertiaCoefficient = 'inertiaCoefficient',
  loadingGauge = 'loadingGauge',
  rollingResistanceA = 'rollingResistanceA',
  rollingResistanceB = 'rollingResistanceB',
  rollingResistanceC = 'rollingResistanceC',
}
