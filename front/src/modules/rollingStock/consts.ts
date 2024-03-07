import type { RollingStockComfortType } from 'common/api/osrdEditoastApi';
import { isElectric } from 'modules/rollingStock/helpers/electric';
import type { ElectricalProfileByMode, SchemaProperty } from 'modules/rollingStock/types';

export const THERMAL_TRACTION_IDENTIFIER = 'thermal';
export const STANDARD_COMFORT_LEVEL: RollingStockComfortType = 'STANDARD';

export const RS_REQUIRED_FIELDS = Object.freeze({
  length: 1,
  mass: { unit: 't', value: 0.1 },
  maxSpeed: { unit: 'km/h', value: 1 },
  startupAcceleration: 0,
  comfortAcceleration: 0,
  startupTime: 0,
  gammaValue: 0.01,
  inertiaCoefficient: 1,
  rollingResistanceA: { unit: 'kN', value: 0 },
  rollingResistanceB: { unit: 'kN/(km/h)', value: 0 },
  rollingResistanceC: { unit: 'kN/(km/h)²', value: 0 },
  electricalPowerStartupTime: 0,
  raisePantographTime: 15,
});

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
  electricalPowerStartupTime = 'electricalPowerStartupTime',
  comfortAcceleration = 'comfortAcceleration',
  gammaValue = 'gammaValue',
  inertiaCoefficient = 'inertiaCoefficient',
  loadingGauge = 'loadingGauge',
  basePowerClass = 'basePowerClass',
  raisePantographTime = 'raisePantographTime',
  rollingResistanceA = 'rollingResistanceA',
  rollingResistanceB = 'rollingResistanceB',
  rollingResistanceC = 'rollingResistanceC',
}

export const DEFAULT_SIGNALING_SYSTEMS = ['BAL', 'BAPR'];

export const RS_SCHEMA_PROPERTIES: readonly SchemaProperty[] = [
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
    min: 1,
    max: 6000,
    unit: 'm',
    side: 'left',
  },
  {
    title: 'mass',
    type: 'number',
    min: 0.1,
    max: 10000,
    units: ['t', 'kg'],
    side: 'left',
  },
  {
    title: 'maxSpeed',
    type: 'number',
    min: 1,
    max: 600,
    units: ['km/h', 'm/s'],
    side: 'left',
  },
  {
    title: 'startupTime',
    type: 'number',
    min: 0,
    max: 60,
    unit: 's',
    side: 'left',
  },
  {
    title: 'startupAcceleration',
    type: 'number',
    min: 0,
    max: 0.2,
    unit: 'm/s²',
    side: 'left',
  },
  {
    title: 'comfortAcceleration',
    type: 'number',
    min: 0,
    max: 1,
    unit: 'm/s²',
    side: 'middle',
  },
  {
    title: 'inertiaCoefficient',
    type: 'number',
    min: 1,
    max: 1.5,
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
    type: 'select',
    enum: ['G1', 'G2', 'GA', 'GB', 'GB1', 'GC', 'FR3.3', 'FR3.3/GB/G2', 'GLOTT'],
    side: 'middle',
  },
  {
    title: 'basePowerClass',
    type: 'string',
    side: 'middle',
  },
  {
    title: 'rollingResistanceA',
    type: 'number',
    min: 0,
    max: 20,
    units: ['kN', 'N', 'kN/t'],
    side: 'right',
    margin: 'mb-3',
  },
  {
    title: 'rollingResistanceB',
    type: 'number',
    min: 0,
    max: 0.5,
    units: ['kN/(km/h)', 'N/(m/s)', 'N/(km/h)', 'kN/(km/h)/t'],
    side: 'right',
    margin: 'mb-3',
  },
  {
    title: 'rollingResistanceC',
    type: 'number',
    min: 0,
    max: 0.01,
    units: ['kN/(km/h)²', 'N/(m/s)²', 'N/(km/h)²', 'kN/(km/h)²/t'],
    side: 'right',
  },
  {
    title: 'electricalPowerStartupTime',
    type: 'number',
    min: 0,
    max: 60,
    unit: 's',
    side: 'left',
    condition: isElectric,
  },
  {
    title: 'raisePantographTime',
    type: 'number',
    min: 0,
    max: 60,
    unit: 's',
    side: 'middle',
    condition: isElectric,
  },
  {
    title: 'supportedSignalingSystems',
    type: 'checkboxes',
    enum: [],
    side: 'left',
  },
];

export const conversionFactorsSchema: { [key: string]: { [key: string]: number } } = {
  t: { kg: 1000 },
  kg: { t: 1 / 1000 },
  'km/h': { 'm/s': 1 / 3.6 },
  'm/s': { 'km/h': 3.6 },
  N: { kN: 1 / 1000 },
  kN: { N: 1000 },
  'N/(m/s)': { 'N/(km/h)': 1 / 3.6, 'kN/(km/h)': 1 / (1000 * 3.6) },
  'N/(km/h)': { 'N/(m/s)': 3.6, 'kN/(km/h)': 1 / 1000 },
  'kN/(km/h)': { 'N/(m/s)': 1000 * 3.6, 'N/(km/h)': 1000 },
  'N/(m/s)²': { 'N/(km/h)²': 1 / 3.6 ** 2, 'kN/(km/h)²': 1 / (1000 * 3.6 ** 2) },
  'N/(km/h)²': { 'N/(m/s)²': 3.6 ** 2, 'kN/(km/h)²': 1 / 1000 },
  'kN/(km/h)²': { 'N/(m/s)²': 1000 * 3.6 ** 2, 'N/(km/h)²': 1000 },
};

const ComfortLevels = {
  STANDARD: 'STANDARD',
  AC: 'AC',
  HEATING: 'HEATING',
};

export const COMFORTS = Object.keys(ComfortLevels) as RollingStockComfortType[];

export const EP_BY_MODE: ElectricalProfileByMode = {
  '1500V': [
    null,
    'O',
    'A',
    'A1',
    'B',
    'B1',
    'C',
    'D',
    'E',
    'F',
    'G',
    'H',
    'I',
    'J',
    'K',
    'L',
    'M',
    'N',
  ],
  '25000V': [null, '25000V', '22500V', '20000V'],
  other: [null],
  thermal: [null],
};
