import type { TFunction } from 'i18next';
import { groupBy, isNull } from 'lodash';

import type { RollingStockForm } from 'common/api/osrdEditoastApi';
import { THERMAL_TRACTION_IDENTIFIER } from 'modules/rollingStock/consts';
import { isElectric } from 'modules/rollingStock/helpers/electric';
import { getTranslationKey } from 'utils/strings';

import { handleUnitValue } from './units';
import { RS_SCHEMA_PROPERTIES } from '../consts';
import { filterNullValueInCurve } from './curves';
import type { RollingStockParametersValidValues, EffortCurveForms, SchemaProperty } from '../types';

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
    const_gamma: data.constGamma,
    inertia_coefficient: data.inertiaCoefficient,
    mass: handleUnitValue({ unit: 'kg', value: data.mass.value }, data.mass, data.mass)!, // Back-end needs value in kg.
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
    primary_category: data.primaryCategory,
    other_categories: [...data.categories].filter((category) => category !== data.primaryCategory),
  };
};

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
): { [key: string]: SchemaProperty[] } => {
  const displayedProperties = RS_SCHEMA_PROPERTIES.filter((property) => {
    const isInThisGroup = propertiesToDisplay.includes(property.title);
    if (checkCondition && effortCurves) {
      const isDisplayed = property.condition ? property.condition(effortCurves) : true;
      return isInThisGroup && isDisplayed;
    }
    return isInThisGroup;
  });
  return groupBy(displayedProperties, 'side');
};

export const translateItemsList = <T>(
  t: TFunction<'translation', 'rollingStock'>,
  itemsList: T[],
  translationKey?: string
) =>
  itemsList.map((item) => ({
    id: item,
    label: !isNull(item)
      ? t(getTranslationKey(translationKey, String(item)), { defaultValue: item })
      : t('unspecified'),
  }));
