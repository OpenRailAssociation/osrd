import type { InputGroupSNCFValue } from 'common/BootstrapSNCF/InputGroupSNCF';
import convertUnits from 'modules/rollingStock/helpers/convertUnits';
import type { MultiUnit, MultiUnitsParameter } from 'modules/rollingStock/types';

import type { RollingStockParametersValues } from '../types';

export const isMultiUnitsParam = (
  param: RollingStockParametersValues[keyof RollingStockParametersValues]
): param is MultiUnitsParameter => (param ? Object.keys(param).includes('value') : false);

export const isMassDependentUnit = (unit?: string) =>
  unit !== undefined && unit !== 't' && unit.endsWith('t');

export const isConversionWithTon = (previousUnit: MultiUnit, newUnit: MultiUnit) =>
  isMassDependentUnit(previousUnit) || isMassDependentUnit(newUnit);

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
  currentMassUnit: MultiUnit,
  previousValue: number
) => {
  const massInTons =
    currentMassUnit === 'kg' ? convertUnits('kg', 't', currentMassValue) : currentMassValue;

  let convertedValue = previousValue;
  if (isMassDependentUnit(newUnit)) {
    convertedValue =
      convertUnits(previousUnit, newUnit.slice(0, -2) as MultiUnit, previousValue) / massInTons;
  } else if (isMassDependentUnit(previousUnit)) {
    convertedValue =
      convertUnits(previousUnit.slice(0, -2) as MultiUnit, newUnit, previousValue) * massInTons;
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

/**
 * Updates a value expressed in a mass dependent unit when the mass change
 * so that the value expressed in a mass independent value does not change.
 * We assume mass dependent units only depend on the mass as 'MultiUnit/t'.
 */
const rescaleMassDependentValue = (
  massDependentValue: number,
  previousMassValue: number,
  previousMassUnit: MultiUnit,
  newMassValue: number,
  newMassUnit: MultiUnit
) => {
  const previousMassInTons =
    previousMassUnit !== 't'
      ? convertUnits(previousMassUnit, 't', previousMassValue)
      : previousMassValue;
  const newMassInTons =
    newMassUnit !== 't' ? convertUnits(newMassUnit, 't', newMassValue) : newMassValue;

  return (massDependentValue * previousMassInTons) / newMassInTons;
};

/** Updates the min and max of a mass dependent parameter so that they remain unchanged
 *  in their initial mass independent unit.
 *
 *  We may want to update the value of the parameter too in the future, but for now
 *  we assume the user inputed mass dependent value was deliberate and should remain.
 */
export const rescaleMassDependentParam = (
  massDependentParam: MultiUnitsParameter,
  previousMass: MultiUnitsParameter,
  newMass: MultiUnitsParameter
): MultiUnitsParameter => ({
  min: rescaleMassDependentValue(
    massDependentParam.min,
    previousMass.value,
    previousMass.unit,
    newMass.value,
    newMass.unit
  ),
  max: rescaleMassDependentValue(
    massDependentParam.max,
    previousMass.value,
    previousMass.unit,
    newMass.value,
    newMass.unit
  ),
  unit: massDependentParam.unit,
  value: massDependentParam.value,
});
