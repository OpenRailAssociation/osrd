import type { TFunction } from 'i18next';
import { has, isNil, pick, omit } from 'lodash';

import type { EffortCurve } from 'common/api/osrdEditoastApi';
import { kmhToMs } from 'utils/physics';
import { getTranslationKey } from 'utils/strings';

import { RS_SCHEMA_PROPERTIES, RS_REQUIRED_FIELDS } from '../consts';
import type {
  RollingStockParametersValues,
  EffortCurveForms,
  RollingStockParametersValidValues,
} from '../types';
import { filterNullValueInCurve } from './curves';
import { isMultiUnitsParam } from './units';

const isInvalidCurve = (curve: EffortCurve) =>
  curve.max_efforts.length < 2 ||
  curve.speeds.length < 2 ||
  new Set(curve.speeds).size !== curve.speeds.length ||
  curve.max_efforts.some((maxEffort) => maxEffort > 1000000) ||
  curve.speeds.some((speed) => speed > kmhToMs(600));

const formatCurveCondition = (
  conditionValue: string | null,
  t: TFunction<'translation', 'rollingStock'>,
  translationCategory?: string
): string => {
  if (conditionValue === null) return t('unspecified');
  if (translationCategory) return t(getTranslationKey(translationCategory, conditionValue));
  return t(conditionValue);
};

type Conditions = Record<string, (effortCurves: EffortCurveForms | null) => boolean>;

const isRollingStockFormValid = (
  rollingStockForm: RollingStockParametersValues,
  effortCurves: EffortCurveForms | null,
  t: TFunction<'translation', 'rollingStock'>
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
    // We consider fields invalid if they are required and either absent or nullish
    const conditionForFieldBeingRequired = conditions[field];
    const isRequired = conditionForFieldBeingRequired
      ? conditionForFieldBeingRequired(effortCurves)
      : true;
    if (!isRequired) return false;

    if (!has(rollingStockForm, field)) return true;

    const paramValue = rollingStockForm[field as keyof RollingStockParametersValues];
    return isNil(isMultiUnitsParam(paramValue) ? paramValue.value : paramValue);
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
            `${formattedComfort} > ${t(mode, { defaultValue: mode })} > ${formattedElecProfile} > ${formattedResCode}`,
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

export default isRollingStockFormValid;
