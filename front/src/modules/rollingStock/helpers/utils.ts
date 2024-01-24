/* eslint-disable @typescript-eslint/no-use-before-define */
import {
  RS_REQUIRED_FIELDS,
  THERMAL_TRACTION_IDENTIFIER,
  RS_SCHEMA_PROPERTIES,
  EP_BY_MODE,
} from 'modules/rollingStock/consts';
import { getTranslationKey } from 'utils/strings';
import { has, isNil, isNull, omit, pick } from 'lodash';
import { isElectric } from 'modules/rollingStock/helpers/electric';
import { TFunction } from 'i18next';

import type {
  ConditionalEffortCurveForm,
  EffortCurveForm,
  EffortCurveForms,
  RollingStockParametersValidValues,
  RollingStockParametersValues,
} from 'modules/rollingStock/types';
import type {
  EffortCurve,
  RollingStockComfortType,
  RollingStock,
  RollingStockForm,
} from 'common/api/osrdEditoastApi';
import type { ValueOf } from 'utils/types';

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

export const filterUndefinedValueInCurve = (curve: EffortCurveForm) =>
  curve.speeds.reduce<EffortCurve>(
    (result, speed, index) => {
      const maxEffort = curve.max_efforts[index];
      if (speed !== undefined && maxEffort !== undefined) {
        result.speeds.push(speed);
        result.max_efforts.push(maxEffort);
      }
      return result;
    },
    { speeds: [] as number[], max_efforts: [] as number[] }
  );

export const getDefaultRollingStockMode = (selectedMode: string | null): EffortCurveForms | null =>
  selectedMode
    ? {
        [`${selectedMode}`]: makeEffortCurve(selectedMode),
      }
    : null;

export const getRollingStockEditorDefaultValues = (
  rollingStockData?: RollingStock
): RollingStockParametersValues =>
  rollingStockData
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
        basePowerClass: rollingStockData.base_power_class || null,
        powerRestrictions: rollingStockData.power_restrictions,
      }
    : {
        ...newRollingStockValues,
      };

export const rollingStockEditorQueryArg = (
  data: RollingStockParametersValidValues,
  currentRsEffortCurve: EffortCurveForms
): RollingStockForm => {
  const electric = isElectric(currentRsEffortCurve);
  const modes = Object.keys(currentRsEffortCurve);
  const default_mode = modes.includes(THERMAL_TRACTION_IDENTIFIER)
    ? THERMAL_TRACTION_IDENTIFIER
    : modes[0];

  const validCurves = Object.keys(currentRsEffortCurve).reduce(
    (acc, mode) => ({
      ...acc,
      [mode]: {
        ...currentRsEffortCurve[mode],
        default_curve: filterUndefinedValueInCurve(currentRsEffortCurve[mode].default_curve),
        curves: [
          ...currentRsEffortCurve[mode].curves.map((curve) => ({
            ...curve,
            curve: filterUndefinedValueInCurve(curve.curve),
          })),
        ],
      },
    }),
    {}
  );

  return {
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
    electrical_power_startup_time: electric ? data.electricalPowerStartupTime : null,
    raise_pantograph_time: electric ? data.raisePantographTime : null,
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
      default_mode,
      modes: validCurves,
    },
    base_power_class: data.basePowerClass,
  };
};

type Conditions = Record<string, (effortCurves: EffortCurveForms | null) => boolean>;

export const checkRollingStockFormValidity = (
  rollingStockForm: RollingStockParametersValues,
  effortCurves: EffortCurveForms | null
): { invalidFields: string[]; validRollingStockForm: RollingStockParametersValidValues } => {
  const conditions = RS_SCHEMA_PROPERTIES.reduce<Conditions>((acc, val) => {
    if (val.condition) {
      return { ...acc, [val.title]: val.condition };
    }
    return acc;
  }, {});
  const invalidFields = Object.keys(RS_REQUIRED_FIELDS).filter((field) => {
    const conditionForFieldBeingRequired = conditions[field];
    const isFieldInvalid = !has(rollingStockForm, field) || isNil(rollingStockForm[field]);
    const isRequired = conditionForFieldBeingRequired
      ? conditionForFieldBeingRequired(effortCurves)
      : true;
    if (isRequired) {
      return isFieldInvalid;
    }
    return false;
  });

  return {
    invalidFields,
    validRollingStockForm: {
      ...pick(RS_REQUIRED_FIELDS, invalidFields),
      ...omit(rollingStockForm, invalidFields),
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
export const sortSelectedModeCurves = (curvesList: ConditionalEffortCurveForm[]) => {
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
    { allConds: [], onlyPR: [], onlyEP: [], nulls: [] } as Record<
      string,
      ConditionalEffortCurveForm[]
    >
  );

  return allConds.concat(onlyPR, onlyEP, nulls);
};

export function makeEffortCurve(selectedMode: string): ValueOf<EffortCurveForms> {
  return {
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
    is_electric: !(selectedMode === THERMAL_TRACTION_IDENTIFIER),
  };
}

export const orderElectricalProfils = (
  electricalProfilesList: (string | null)[],
  selectedTractionMode: string | null
) => {
  const isSelectedModeWithProfiles =
    selectedTractionMode === '1500V' || selectedTractionMode === '25000V';
  if (isSelectedModeWithProfiles) {
    const refArray = EP_BY_MODE[selectedTractionMode];
    return electricalProfilesList.sort((a, b) => refArray.indexOf(a) - refArray.indexOf(b));
  }
  return electricalProfilesList;
};

export const translateItemsList = <T>(t: TFunction, itemsList: T[], translationKey?: string) =>
  itemsList.map((item) => ({
    id: item,
    label: !isNull(item) ? t(getTranslationKey(translationKey, String(item))) : t('unspecified'),
  }));

/**
 * conversion table as an object,
 * its values are the number to multiply the old value in old unit to get the new value in desired unit
 */
export const conversionFactors = {
    t: { kg: 1000 },
    kg: { t: 1 / 1000 },
    'km/h': { 'm/s': 1 / 3.6, 'N/(km/h)': 1 / (9.81 * 3.6) },
    'm/s': { 'km/h': 3.6, 'N/(m/s)': 1 / 9.81 },
    N: { daN: 1 / 10, kN: 1e-3, 'N/(km/h)': 9.81, 'N/(m/s)': 9.81 },
    daN: { N: 10, kN: 1e-2 },
    kN: { N: 1000, daN: 100 },
};
/**
 * converts a property of a RollingStock object if it is doable
 * @param oldValue
 * @param oldUnit
 * @param newUnit
 */
export const convertUnit = (oldValue: number, oldUnit: string, newUnit: string): number => {

    if (!conversionFactors[oldUnit] || !conversionFactors[newUnit]) {
        throw new Error(`Cannot convert one of the units`)
    }

    if (!conversionFactors[oldUnit]) {
        throw new Error(`Unit ${oldUnit} not supported`);
    }

    if (!conversionFactors[oldUnit][newUnit]) {
        throw new Error(`Cannot convert between ${oldUnit} and ${newUnit}`);
    }

    return oldValue * conversionFactors[oldUnit][newUnit];
}
