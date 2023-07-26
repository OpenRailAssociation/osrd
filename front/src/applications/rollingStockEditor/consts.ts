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
  side: string;
  format?: string;
  enum?: string[];
  min?: number;
  max?: number;
  unit?: string;
  units?: string[];
};

export enum RollingStockEditorMetadata {
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

export enum RollingStockEditorParameter {
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

export const RollingStockSchemaProperties: SchemaProperty[] = [
  {
    title: 'name',
    type: 'string',
    side: 'left',
  },
  {
    title: 'detail',
    type: 'string',
    side: 'left',
  },
  {
    title: 'family',
    type: 'string',
    side: 'left',
  },
  {
    title: 'grouping',
    type: 'string',
    side: 'left',
  },
  {
    title: 'number',
    type: 'string',
    side: 'middle',
  },
  {
    title: 'reference',
    type: 'string',
    side: 'middle',
  },
  {
    title: 'series',
    type: 'string',
    side: 'middle',
  },
  {
    title: 'subseries',
    type: 'string',
    side: 'right',
  },
  {
    title: 'type',
    type: 'string',
    side: 'right',
  },
  {
    title: 'unit',
    type: 'string',
    side: 'right',
  },
  {
    title: 'length',
    type: 'number',
    min: 0,
    max: 2000,
    unit: 'm',
    side: 'left',
  },
  {
    title: 'mass',
    type: 'number',
    min: 0,
    max: 100000000,
    units: ['kg', 't'],
    side: 'left',
  },
  {
    title: 'maxSpeed',
    type: 'number',
    min: 0,
    max: 600,
    unit: 'km/h',
    side: 'left',
  },
  {
    title: 'startupTime',
    type: 'number',
    min: 0,
    unit: 's',
    side: 'left',
  },
  {
    title: 'startupAcceleration',
    type: 'number',
    min: 0,
    unit: 'm/s²',
    side: 'left',
  },
  {
    title: 'comfortAcceleration',
    type: 'number',
    min: 0.01,
    unit: 'm/s²',
    side: 'middle',
  },
  {
    title: 'inertiaCoefficient',
    type: 'number',
    min: 1,
    max: 2,
    side: 'middle',
  },
  {
    title: 'gammaValue',
    type: 'number',
    min: 0.01,
    max: 2,
    unit: 'm/s²',
    side: 'middle',
  },
  {
    title: 'loadingGauge',
    type: 'string',
    enum: ['G1', 'G2', 'GA', 'GB', 'GB1', 'GC', 'FR3.3', 'FR3.3/GB/G2', 'GLOTT'],
    side: 'middle',
  },
  {
    title: 'rollingResistanceA',
    type: 'number',
    min: 0,
    units: ['N', 'daN', 'daN/t'],
    side: 'right',
  },
  {
    title: 'rollingResistanceB',
    type: 'number',
    min: 0,
    units: ['N/(m/s)', 'daN/(km/h)', 'daN/(km/h)/t'],
    side: 'right',
  },
  {
    title: 'rollingResistanceC',
    type: 'number',
    min: 0,
    units: ['N/(m/s)²', 'daN/(km/h)²', 'daN/(km/h)²/t'],
    side: 'right',
  },
];
