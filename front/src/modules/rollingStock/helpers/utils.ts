import {
  RollingStockComfortType,
  ConditionalEffortCurve,
  RollingStock,
  RollingStockForm,
} from 'common/api/osrdEditoastApi';
import { has, isNull, omitBy, some } from 'lodash';
import {
  EffortCurves,
  RollingStockParametersValidValues,
  RollingStockParametersValues,
  THERMAL_TRACTION_IDENTIFIER,
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
  loadingGauge: 'G1' as RollingStockParametersValues['loadingGauge'],
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
        electricalPowerStartupTime: rollingStockData.electrical_power_startup_time || null,
        raisePantographTime: rollingStockData.raise_pantograph_time || null,
        defaultMode: rollingStockData.effort_curves.default_mode,
        effortCurves,
        basePowerClass: rollingStockData.base_power_class || null,
        powerRestrictions: rollingStockData.power_restrictions,
      }
    : {
        ...newRollingStockValues,
        defaultMode: selectedMode,
        effortCurves,
      };
};

export const rollingStockEditorQueryArg = (
  data: RollingStockParametersValidValues,
  currentRsEffortCurve: RollingStock['effort_curves']
): RollingStockForm => ({
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
  base_power_class: data.basePowerClass,
});

export const checkRollingStockFormValidity = (
  rollingStockForm: RollingStockParametersValues
): { invalidFields: string[]; validRollingStockForm: RollingStockParametersValidValues } => {
  const invalidFields = [
    'length',
    'mass',
    'maxSpeed',
    'startupAcceleration',
    'comfortAcceleration',
    'startupTime',
    'gammaValue',
    'inertiaCoefficient',
    'rollingResistanceA',
    'rollingResistanceB',
    'rollingResistanceC',
  ].reduce(
    (result, field) =>
      !has(rollingStockForm, field) || rollingStockForm[field] === undefined
        ? [...result, field]
        : result,
    [] as string[]
  );

  return {
    invalidFields,
    validRollingStockForm: {
      length: 0,
      maxSpeed: 0,
      startupAcceleration: 0,
      comfortAcceleration: 0.01,
      mass: 0,
      startupTime: 0,
      gammaValue: 0.01,
      inertiaCoefficient: 1,
      rollingResistanceA: 0,
      rollingResistanceB: 0,
      rollingResistanceC: 0,
      ...omitBy(rollingStockForm, (value) => value === undefined),
    } as RollingStockParametersValidValues,
  };
};

export const createEmptyCurve = (
  comfort: RollingStockComfortType,
  electricalProfile: string | null = null,
  powerRestriction: string | null = null
) => ({
  cond: {
    comfort,
    electrical_profile_level: electricalProfile,
    power_restriction_code: powerRestriction,
  },
  curve: { speeds: [0], max_efforts: [0] },
});

/** given a tractionMode and a list of comfort, return empty EffortCurves */
export const createEmptyCurves = (tractionMode: string, comforts: RollingStockComfortType[]) => ({
  curves: comforts.map((comfort) => createEmptyCurve(comfort)),
  default_curve: { speeds: [0], max_efforts: [0] },
  is_electric: tractionMode !== THERMAL_TRACTION_IDENTIFIER,
});

export const orderSelectorList = (list: (string | null)[]) => {
  const index = list.includes('O') ? 2 : 1;
  return isNull(list[0]) || list[0] === 'O'
    ? list.slice(0, index).concat(list.slice(index).sort())
    : list.sort();
};

/** This function will sort the curves list based on the number of conditions they have.
 *
 * Curves will be sorted in the following order (comfort is compulsory):
 * - curves with all conditions (power restriction & electrical profile)
 * - curves with at least power restriction
 * - curves with least electrical profile
 * - other curves (without power restriction and without electrical profile)
 */
export const sortSelectedModeCurves = (curvesList: ConditionalEffortCurve[]) => {
  const { allConds, onlyPR, onlyEP, nulls } = curvesList.reduce(
    (sortedCurves, curve) => {
      const { cond } = curve;
      if (!cond) return sortedCurves;
      if (cond.electrical_profile_level && cond.power_restriction_code) {
        return { ...sortedCurves, allConds: [...sortedCurves.allConds, curve] };
      }
      if (cond.power_restriction_code) {
        return { ...sortedCurves, onlyPR: [...sortedCurves.onlyPR, curve] };
      }
      if (cond.electrical_profile_level) {
        return { ...sortedCurves, onlyEP: [...sortedCurves.onlyEP, curve] };
      }
      return { ...sortedCurves, nulls: [...sortedCurves.nulls, curve] };
    },
    { allConds: [], onlyPR: [], onlyEP: [], nulls: [] } as Record<string, ConditionalEffortCurve[]>
  );

  return allConds.concat(onlyPR, onlyEP, nulls);
};

export const isElectric = (rollingStock: RollingStock) =>
  some(Object.values(rollingStock.effort_curves.modes), (effortCurve) => effortCurve.is_electric);
