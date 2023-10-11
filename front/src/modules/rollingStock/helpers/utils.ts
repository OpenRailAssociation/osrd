import { Comfort, RollingStock, RollingStockUpsertPayload } from 'common/api/osrdEditoastApi';
import { isNull, some } from 'lodash';
import {
  EffortCurves,
  RollingStockParametersValues,
  STANDARD_COMFORT_LEVEL,
} from 'modules/rollingStock/consts';

const newRollingStockValues = {
  railjsonVersion: '',
  name: '',
  detail: '',
  family: '',
  grouping: '',
  number: '',
  reference: '',
  series: '',
  subseries: '',
  type: '',
  unit: '',
  length: 0,
  mass: 0,
  maxSpeed: 0,
  startupTime: 0,
  startupAcceleration: 0,
  comfortAcceleration: 0.01,
  gammaValue: 0.01,
  inertiaCoefficient: 1,
  loadingGauge: 'G1' as RollingStockParametersValues['loadingGauge'],
  rollingResistanceA: 0,
  rollingResistanceB: 0,
  rollingResistanceC: 0,
  electricalPowerStartupTime: null,
  raisePantographTime: null,
  basePowerClass: null,
  powerRestrictions: {},
};

export const getDefaultRollingStockMode = (
  selectedMode: string
): RollingStock['effort_curves'] => ({
  default_mode: selectedMode,
  modes: {
    [`${selectedMode}`]: {
      curves: [
        {
          cond: {
            comfort: 'STANDARD',
            electrical_profile_level: null,
            power_restriction_code: null,
          },
          curve: {
            max_efforts: [0],
            speeds: [0],
          },
        },
      ],
      default_curve: {
        max_efforts: [],
        speeds: [],
      },
      is_electric: false,
    },
  },
});

export const getRollingStockEditorDefaultValues = (
  selectedMode: string | null,
  rollingStockData?: RollingStock
): RollingStockParametersValues => {
  let effortCurves: EffortCurves = { modes: {} };
  const completeSelectedMode = selectedMode
    ? getDefaultRollingStockMode(selectedMode).modes[selectedMode]
    : null;
  if (completeSelectedMode) {
    effortCurves = {
      modes: {
        [selectedMode as string]: {
          curves: completeSelectedMode.curves,
          isElectric: completeSelectedMode.is_electric,
          defaultCurve: completeSelectedMode.default_curve,
        },
      },
    };
  }
  return rollingStockData
    ? {
        railjsonVersion: rollingStockData.railjson_version,
        name: rollingStockData.name,
        detail: rollingStockData.metadata.detail,
        family: rollingStockData.metadata.family,
        grouping: rollingStockData.metadata.grouping,
        number: rollingStockData.metadata.number,
        reference: rollingStockData.metadata.reference,
        series: rollingStockData.metadata.series,
        subseries: rollingStockData.metadata.subseries,
        type: rollingStockData.metadata.type,
        unit: rollingStockData.metadata.unit,
        length: rollingStockData.length,
        mass: rollingStockData.mass / 1000, // The mass received is in kg and should appear in tons.
        maxSpeed: rollingStockData.max_speed * 3.6, // The speed received is in m/s and should appear in km/h.
        startupTime: rollingStockData.startup_time,
        startupAcceleration: rollingStockData.startup_acceleration,
        comfortAcceleration: rollingStockData.comfort_acceleration,
        gammaValue: rollingStockData.gamma.value,
        inertiaCoefficient: rollingStockData.inertia_coefficient,
        loadingGauge: rollingStockData.loading_gauge,
        rollingResistanceA: rollingStockData.rolling_resistance.A,
        rollingResistanceB: rollingStockData.rolling_resistance.B,
        rollingResistanceC: rollingStockData.rolling_resistance.C,
        electricalPowerStartupTime: rollingStockData.electrical_power_startup_time,
        raisePantographTime: rollingStockData.raise_pantograph_time,
        defaultMode: rollingStockData.effort_curves.default_mode,
        effortCurves,
        basePowerClass: rollingStockData.base_power_class,
        powerRestrictions: rollingStockData.power_restrictions,
      }
    : {
        ...newRollingStockValues,
        defaultMode: selectedMode,
        effortCurves,
      };
};

export const rollingStockEditorQueryArg = (
  data: RollingStockParametersValues,
  currentRsEffortCurve: RollingStock['effort_curves']
): RollingStockUpsertPayload => ({
  name: data.name,
  length: data.length,
  max_speed: data.maxSpeed / 3.6, // The user enters a value in km/h, which is then interpreted in m/s by the server.
  startup_time: data.startupTime,
  startup_acceleration: data.startupAcceleration,
  comfort_acceleration: data.comfortAcceleration,
  gamma: {
    type: 'CONST',
    value: data.gammaValue,
  },
  inertia_coefficient: data.inertiaCoefficient,
  features: [],
  mass: data.mass * 1000, // Here we receive a value in ton which will be interpreted in kg by the server.
  rolling_resistance: {
    A: data.rollingResistanceA,
    B: data.rollingResistanceB,
    C: data.rollingResistanceC,
    type: 'davis',
  },
  loading_gauge: data.loadingGauge,
  power_restrictions: data.powerRestrictions,
  energy_sources: [],
  electrical_power_startup_time: data.electricalPowerStartupTime,
  raise_pantograph_time: data.raisePantographTime,
  metadata: {
    detail: data.detail || data.name,
    family: data.family,
    grouping: data.grouping,
    number: data.number,
    reference: data.reference || data.name,
    series: data.series,
    subseries: data.subseries,
    type: data.type,
    unit: data.unit,
  },
  effort_curves: currentRsEffortCurve,
  base_power_class: data.basePowerClass || null,
});

export const createEmptyCurve = (
  comfort: Comfort,
  electricalProfile: string | null = null,
  powerRestriction: string | null = null
) => ({
  cond: {
    comfort: comfort || STANDARD_COMFORT_LEVEL,
    electrical_profile_level: electricalProfile,
    power_restriction_code: powerRestriction,
  },
  curve: { speeds: [0], max_efforts: [0] },
});

export const orderSelectorList = (list: (string | null)[]) => {
  const index = list.includes('O') ? 2 : 1;
  return isNull(list[0]) || list[0] === 'O'
    ? list.slice(0, index).concat(list.slice(index).sort())
    : list.sort();
};

export const isElectric = (rollingStock: RollingStock) =>
  some(Object.values(rollingStock.effort_curves.modes), (effortCurve) => effortCurve.is_electric);
