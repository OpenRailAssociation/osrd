/* eslint-disable @typescript-eslint/no-use-before-define */
import type { TFunction } from 'i18next';
import { floor, groupBy, has, isNil, isNull, omit, pick } from 'lodash';

import type {
  EffortCurve,
  Comfort,
  RollingStock,
  RollingStockForm,
} from 'common/api/osrdEditoastApi';
import type { InputGroupSNCFValue } from 'common/BootstrapSNCF/InputGroupSNCF';
import {
  RS_REQUIRED_FIELDS,
  THERMAL_TRACTION_IDENTIFIER,
  EP_BY_MODE,
  RS_SCHEMA_PROPERTIES,
  CONVERSION_FACTORS_SCHEMA,
  newRollingStockValues,
} from 'modules/rollingStock/consts';
import { isElectric } from 'modules/rollingStock/helpers/electric';
import type {
  ConditionalEffortCurveForm,
  EffortCurveForm,
  EffortCurveForms,
  MultiUnit,
  MultiUnitsParameter,
  RollingStockParametersValidValues,
  RollingStockParametersValues,
  SchemaProperty,
} from 'modules/rollingStock/types';
import { kmhToMs, msToKmh } from 'utils/physics';
import { getTranslationKey } from 'utils/strings';
import type { ValueOf } from 'utils/types';

export const filterNullValueInCurve = (curve: EffortCurveForm) =>
  curve.speeds.reduce<EffortCurve>(
    (result, speed, index) => {
      const maxEffort = curve.max_efforts[index];
      if (speed !== null && maxEffort !== null) {
        result.speeds.push(speed);
        result.max_efforts.push(maxEffort);
      }
      return result;
    },
    { speeds: [], max_efforts: [] }
  );

export const getDefaultRollingStockMode = (selectedMode: string | null): EffortCurveForms | null =>
  selectedMode
    ? {
        [`${selectedMode}`]: makeEffortCurve(selectedMode),
      }
    : null;

const getDefaultMultiUnitsParameter = (parameter: string): MultiUnitsParameter => {
  const { min, max, units } = RS_SCHEMA_PROPERTIES.find(
    (rsParam) => rsParam.title === parameter
  ) as SchemaProperty;
  return {
    min: min!,
    max: max!,
    unit: units![0],
    value: 0,
  };
};

export const getRollingStockEditorDefaultValues = (
  rollingStockData?: RollingStock
): RollingStockParametersValues =>
  rollingStockData
    ? {
        railjsonVersion: rollingStockData.railjson_version,
        name: rollingStockData.name,
        detail: rollingStockData.metadata?.detail || '',
        family: rollingStockData.metadata?.family || '',
        grouping: rollingStockData.metadata?.grouping || '',
        number: rollingStockData.metadata?.number || '',
        reference: rollingStockData.metadata?.reference || '',
        series: rollingStockData.metadata?.series || '',
        subseries: rollingStockData.metadata?.subseries || '',
        type: rollingStockData.metadata?.type || '',
        unit: rollingStockData.metadata?.unit || '',
        length: rollingStockData.length,
        mass: {
          ...getDefaultMultiUnitsParameter('mass'),
          value: rollingStockData.mass / 1000, // The mass received is in kg and should appear in tons.
        },
        maxSpeed: {
          ...getDefaultMultiUnitsParameter('maxSpeed'),
          value: msToKmh(rollingStockData.max_speed), // The speed received is in m/s and should appear in km/h.
        },
        startupTime: rollingStockData.startup_time,
        startupAcceleration: rollingStockData.startup_acceleration,
        comfortAcceleration: rollingStockData.comfort_acceleration,
        gammaValue: rollingStockData.gamma.value,
        inertiaCoefficient: rollingStockData.inertia_coefficient,
        loadingGauge: rollingStockData.loading_gauge,
        rollingResistanceA: {
          ...getDefaultMultiUnitsParameter('rollingResistanceA'),
          value: rollingStockData.rolling_resistance.A / 1000, // The b resistance received is in N and should appear in kN.
        },
        rollingResistanceB: {
          ...getDefaultMultiUnitsParameter('rollingResistanceB'),
          value: rollingStockData.rolling_resistance.B / (1000 * 3.6), // The b resistance received is in N/(m/s) and should appear in kN/(km/h).
        },
        rollingResistanceC: {
          ...getDefaultMultiUnitsParameter('rollingResistanceC'),
          value: rollingStockData.rolling_resistance.C / (1000 * 3.6 ** 2), // The c resistance received is in N/(m/s)² and should appear in kN/(km/h)².
        },
        electricalPowerStartupTime: rollingStockData.electrical_power_startup_time || null,
        raisePantographTime: rollingStockData.raise_pantograph_time || null,
        basePowerClass: rollingStockData.base_power_class || null,
        powerRestrictions: rollingStockData.power_restrictions,
        supportedSignalingSystems: rollingStockData.supported_signaling_systems,
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
        default_curve: filterNullValueInCurve(currentRsEffortCurve[mode].default_curve),
        curves: [
          ...currentRsEffortCurve[mode].curves.map((curve) => ({
            ...curve,
            curve: filterNullValueInCurve(curve.curve),
          })),
        ],
      },
    }),
    {}
  );

  return {
    name: data.name,
    length: data.length,
    max_speed: handleUnitValue(
      { unit: 'm/s', value: data.maxSpeed.value },
      data.maxSpeed,
      data.mass
    )!, // Back-end needs value in m/s.
    startup_time: data.startupTime,
    startup_acceleration: data.startupAcceleration,
    comfort_acceleration: data.comfortAcceleration,
    gamma: {
      type: 'CONST',
      value: data.gammaValue,
    },
    inertia_coefficient: data.inertiaCoefficient,
    mass: handleUnitValue({ unit: 'kg', value: data.mass.value }, data.mass, data.mass) as number, // Back-end needs value in kg.
    rolling_resistance: {
      A: handleUnitValue(
        { unit: 'N', value: data.rollingResistanceA.value },
        data.rollingResistanceA,
        data.mass
      )!, // Back-end needs value in N.
      B: handleUnitValue(
        { unit: 'N/(m/s)', value: data.rollingResistanceB.value },
        data.rollingResistanceB,
        data.mass
      )!, // Back-end needs value in N/(m/s).
      C: handleUnitValue(
        { unit: 'N/(m/s)²', value: data.rollingResistanceC.value },
        data.rollingResistanceC,
        data.mass
      )!, // Back-end needs value in N/(m/s)².
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
    supported_signaling_systems: data.supportedSignalingSystems,
  };
};

type Conditions = Record<string, (effortCurves: EffortCurveForms | null) => boolean>;

const isMultiUnitsParam = (
  param:
    | string
    | number
    | string[]
    | { [key: string]: string }
    | MultiUnitsParameter
    | null
    | undefined
): param is MultiUnitsParameter =>
  param ? Object.keys(param as MultiUnitsParameter).includes('value') : false;

export const isInvalidCurve = (curve: EffortCurve) =>
  curve.max_efforts.length < 2 ||
  curve.speeds.length < 2 ||
  new Set(curve.speeds).size !== curve.speeds.length ||
  curve.max_efforts.some((maxEffort) => maxEffort > 1000000) ||
  curve.speeds.some((speed) => speed > kmhToMs(600));

export const checkRollingStockFormValidity = (
  rollingStockForm: RollingStockParametersValues,
  effortCurves: EffortCurveForms | null,
  t: TFunction
): {
  invalidFields: string[];
  validRollingStockForm: RollingStockParametersValidValues;
  invalidEffortCurves: string[];
} => {
  const conditions = RS_SCHEMA_PROPERTIES.reduce<Conditions>((acc, val) => {
    if (val.condition) {
      return { ...acc, [val.title]: val.condition };
    }
    return acc;
  }, {});
  const invalidFields = Object.keys(RS_REQUIRED_FIELDS).filter((field) => {
    const conditionForFieldBeingRequired = conditions[field];
    const paramValue = rollingStockForm[field];
    const isFieldInvalid =
      !has(rollingStockForm, field) ||
      isNil(isMultiUnitsParam(paramValue) ? paramValue.value : paramValue);
    const isRequired = conditionForFieldBeingRequired
      ? conditionForFieldBeingRequired(effortCurves)
      : true;
    if (isRequired) {
      return isFieldInvalid;
    }
    return false;
  });

  let invalidEffortCurves: string[] = [];
  Object.entries(effortCurves || {}).forEach(([mode, { curves }]) => {
    curves.forEach(
      ({ curve, cond: { comfort, electrical_profile_level, power_restriction_code } }) => {
        const filteredCurve = filterNullValueInCurve(curve);

        if (isInvalidCurve(filteredCurve)) {
          const formattedComfort = formatCurveCondition(comfort, t, 'comfortTypes');
          const formattedElecProfile = formatCurveCondition(electrical_profile_level, t);
          const formattedResCode = formatCurveCondition(power_restriction_code, t);

          invalidEffortCurves = [
            ...invalidEffortCurves,
            `${formattedComfort} > ${t(mode)} > ${formattedElecProfile} > ${formattedResCode}`,
          ];
        }
      }
    );
  });

  return {
    invalidFields,
    validRollingStockForm: {
      ...pick(RS_REQUIRED_FIELDS, invalidFields),
      ...omit(rollingStockForm, invalidFields),
    } as RollingStockParametersValidValues,
    invalidEffortCurves,
  };
};

const formatCurveCondition = (
  conditionValue: string | null,
  t: TFunction,
  translationCategory?: string
): string => {
  if (conditionValue === null) return t('unspecified');
  if (translationCategory) return t(getTranslationKey(translationCategory, conditionValue));
  return t(conditionValue);
};

export const createEmptyCurve = (
  comfort: Comfort,
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
export const createEmptyCurves = (tractionMode: string, comforts: Comfort[]) => ({
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
 * This function divides rolling stock properties according to:
 * - their name
 * - the side of the form where they should be displayed.
 * @param propertiesToDisplay List of the properties names we need to display in this part of the form
 * @param effortCurves List of the rolling stock effort curves
 * @param checkCondition Indicates whether to check for the presence of an electrical mode
 * @returns An object with 3 lists of properties for each side of the form
 */
export const splitRollingStockProperties = (
  propertiesToDisplay: string[],
  effortCurves?: EffortCurveForms | null,
  checkCondition?: boolean
) => {
  const displayedProperties = RS_SCHEMA_PROPERTIES.filter((property) => {
    const isInThisGroup = propertiesToDisplay.includes(property.title);
    if (checkCondition && effortCurves) {
      const isDisplayed = property.condition ? property.condition(effortCurves) : true;
      return isInThisGroup && isDisplayed;
    }
    return isInThisGroup;
  });
  return groupBy(displayedProperties, 'side') as { [key: string]: SchemaProperty[] };
};

/**
 * According the conversion factors schema, convert a value if
 * the factors exist in the schema
 */
export const convertUnits = (
  prevUnit: MultiUnit,
  newUnit: MultiUnit,
  prevValue: number,
  maxDecimals?: number
): number => {
  let result = prevValue;
  const conversionFactorFromPrevUnit = CONVERSION_FACTORS_SCHEMA[prevUnit];
  if (conversionFactorFromPrevUnit && conversionFactorFromPrevUnit[newUnit]) {
    const conversionFactor = conversionFactorFromPrevUnit[newUnit];
    if (conversionFactor) result = conversionFactor * prevValue;
  }
  return maxDecimals ? floor(result, maxDecimals) : result;
};

export const isConversionWithTon = (previousUnit: string, newUnit: string) =>
  previousUnit !== 't' && newUnit !== 't' && (previousUnit.endsWith('t') || newUnit.endsWith('t'));

/**
 * For the rollingstock resistance (a, b or c), check if its unit
 * to be converted or the unit to convert to is by ton (i.e. daN/t).
 *
 * As the resistance mass unit can only be in ton, return the converted
 * resistance depending if the rollingstock's current mass is in kg or ton
 */
export const convertUnitsWithMass = (
  previousUnit: MultiUnit,
  newUnit: MultiUnit,
  currentMassValue: number,
  currentMassUnit: string,
  previousValue: number
) => {
  let convertedValue = previousValue;

  const massInTons =
    currentMassUnit === 'kg' ? convertUnits('kg', 't', currentMassValue) : currentMassValue;
  if (isConversionWithTon(previousUnit, newUnit)) {
    if (newUnit.endsWith('t')) {
      convertedValue =
        convertUnits(previousUnit, newUnit.slice(0, -2) as MultiUnit, previousValue) / massInTons;
    } else {
      convertedValue =
        convertUnits(previousUnit.slice(0, -2) as MultiUnit, newUnit, previousValue) * massInTons;
    }
  }

  return convertedValue;
};

/**
 * When switching unit for the rollingstock's multi units parameters,
 * convert the parameter value or its min/max interval into the good unit
 * depending if there is an unit and if it has changed or not.
 *
 * @param option contains the unit and value from the parameter input
 * @param param contains the current properties (unit, value, min, max) of the parameter
 * @param currentMass the current mass of the edited rolling stock
 * @param valueType tells if we are changing the value of the parameter of its min or max
 * @returns
 */
export const handleUnitValue = <U extends MultiUnit>(
  option: InputGroupSNCFValue<U>,
  param: MultiUnitsParameter,
  currentMass?: RollingStockParametersValues['mass'],
  valueType: 'value' | 'min' | 'max' = 'value'
): number | undefined => {
  const valueToConvert = valueType === 'value' ? option.value : param[valueType];

  if (valueToConvert === undefined) return undefined;

  if (option.unit !== param.unit && valueToConvert !== 0) {
    const result =
      currentMass && isConversionWithTon(param.unit, option.unit)
        ? convertUnitsWithMass(
            param.unit,
            option.unit,
            currentMass.value,
            currentMass.unit,
            valueToConvert
          )
        : convertUnits(param.unit, option.unit, valueToConvert);

    return result;
  }
  return +valueToConvert;
};
