import { EffortCurve, RollingStock, RollingStockUpsertPayload } from 'common/api/osrdEditoastApi';
import { RollingStockParametersValues } from './consts';

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

const getRollingStockEditorDefaultValues = (
  selectedMode: string,
  rollingStockData?: RollingStock
): RollingStockParametersValues => {
  const completeSelectedMode = getDefaultRollingStockMode(selectedMode).modes[`${selectedMode}`];
  const formattedSelectedMode = {
    curves: completeSelectedMode.curves,
    isElectric: completeSelectedMode.is_electric,
    defaultCurve: completeSelectedMode.default_curve,
  };
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
        defaultMode: rollingStockData.effort_curves.default_mode || selectedMode,
        effortCurves: {
          modes: {
            [`${selectedMode}`]: formattedSelectedMode,
          },
        },
      }
    : {
        ...newRollingStockValues,
        defaultMode: selectedMode,
        effortCurves: {
          modes: {
            [`${selectedMode}`]: formattedSelectedMode,
          },
        },
      };
};

export const rollingStockEditorQueryArg = (
  data: RollingStockParametersValues,
  selectedMode: string,
  currentRsEffortCurve: RollingStock['effort_curves'],
  isAdding?: boolean
): RollingStockUpsertPayload => ({
  railjson_version: data.railjsonVersion,
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
  base_power_class: '',
  power_restrictions: {},
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
  effort_curves: {
    default_mode: selectedMode,
    modes: {
      [`${selectedMode}`]: {
        curves: currentRsEffortCurve.modes[`${selectedMode}`].curves,
        is_electric: currentRsEffortCurve.modes[`${selectedMode}`].is_electric,
        default_curve: isAdding
          ? (currentRsEffortCurve.modes[`${selectedMode}`].curves[0].curve as EffortCurve)
          : currentRsEffortCurve.modes[`${selectedMode}`].default_curve,
      },
    },
  },
});

export default getRollingStockEditorDefaultValues;
