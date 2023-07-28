import { EffortCurve, RollingStock, RollingStockUpsertPayload } from 'common/api/osrdEditoastApi';
import { RollingStockParametersValues } from './consts';

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
): RollingStockParametersValues => ({
  railjsonVersion: rollingStockData?.railjson_version || '',
  name: rollingStockData?.name || '',
  detail: rollingStockData?.metadata.detail || '',
  family: rollingStockData?.metadata.family || '',
  grouping: rollingStockData?.metadata.grouping || '',
  number: rollingStockData?.metadata.number || '',
  reference: rollingStockData?.metadata.reference || '',
  series: rollingStockData?.metadata.series || '',
  subseries: rollingStockData?.metadata.subseries || '',
  type: rollingStockData?.metadata.type || '',
  unit: rollingStockData?.metadata.unit || '',
  length: rollingStockData?.length || 0,
  mass: rollingStockData ? rollingStockData.mass / 1000 : 0, // The mass received is in kg and should appear in tons.
  maxSpeed: rollingStockData ? rollingStockData.max_speed * 3.6 : 0, // The speed received is in m/s and should appear in km/h.
  startupTime: rollingStockData?.startup_time || 0,
  startupAcceleration: rollingStockData?.startup_acceleration || 0,
  comfortAcceleration: rollingStockData?.comfort_acceleration || 0.01,
  gammaValue: rollingStockData?.gamma.value || 0.01,
  inertiaCoefficient: rollingStockData?.inertia_coefficient || 1,
  loadingGauge: rollingStockData?.loading_gauge || 'G1',
  rollingResistanceA: rollingStockData?.rolling_resistance.A || 0,
  rollingResistanceB: rollingStockData?.rolling_resistance.B || 0,
  rollingResistanceC: rollingStockData?.rolling_resistance.C || 0,
  electricalPowerStartupTime: rollingStockData?.electrical_power_startup_time || null,
  raisePantographTime: rollingStockData?.raise_pantograph_time || null,
  defaultMode: rollingStockData?.effort_curves.default_mode || selectedMode,
  effortCurves: {
    modes: {
      [`${selectedMode}`]: {
        curves: getDefaultRollingStockMode(selectedMode).modes[`${selectedMode}`].curves,
        isElectric: getDefaultRollingStockMode(selectedMode).modes[`${selectedMode}`].is_electric,
        defaultCurve:
          getDefaultRollingStockMode(selectedMode).modes[`${selectedMode}`].default_curve,
      },
    },
  },
});

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
