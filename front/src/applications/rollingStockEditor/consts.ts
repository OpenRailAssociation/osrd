export type RollingStockParametersValues = {
  [key: number | string]: {
    name: string;
    version: string;
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
    max_speed: number;
    startup_time: number;
    startup_acceleration: number;
    comfort_acceleration: number;
    gamma_value: number;
    inertia_coefficient: number;
    loading_gauge: string;
    rolling_resistance_A: number;
    rolling_resistance_B: number;
    rolling_resistance_C: number;
    electrical_power_startup_time: number;
    raise_pantograph_time: number;
    default_mode: string;
    is_electric: boolean;
  };
};

export enum Metadata {
  name = 'name',
  version = 'version',
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
  max_speed = 'max_speed',
  startup_time = 'startup_time',
  startup_acceleration = 'startup_acceleration',
  comfort_acceleration = 'comfort_acceleration',
  gamma_value = 'gamma_value',
  inertia_coefficient = 'inertia_coefficient',
  loading_gauge = 'loading_gauge',
  rolling_resistance_A = 'rolling_resistance_A',
  rolling_resistance_B = 'rolling_resistance_B',
  rolling_resistance_C = 'rolling_resistance_C',
}

export enum RollingStockResistance {
  rolling_resistance_A = 'rolling_resistance_A',
  rolling_resistance_B = 'rolling_resistance_B',
  rolling_resistance_C = 'rolling_resistance_C',
}

export const sideValue = {
  left: true,
  right: false,
};
