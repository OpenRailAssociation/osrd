import { useState } from 'react';

import cx from 'classnames';
import { floor, isNil } from 'lodash';
import { useTranslation } from 'react-i18next';

import InputGroupSNCF, { type InputGroupSNCFValue } from 'common/BootstrapSNCF/InputGroupSNCF';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import SelectSNCF from 'common/BootstrapSNCF/SelectSNCF';
import type { MultiUnit, MultiUnitsParameter } from 'modules/rollingStock/types';

import { RollingStockEditorParameter, RS_REQUIRED_FIELDS } from '../consts';
import {
  handleUnitValue,
  isMassDependentUnit,
  isMultiUnitsParam,
  rescaleMassDependentParam,
} from '../helpers/units';
import { splitRollingStockProperties } from '../helpers/utils';
import type { RollingStockParametersValues, SchemaProperty, EffortCurveForms } from '../types';

type RollingStockEditorParameterFormProps = {
  rollingStockValues: RollingStockParametersValues;
  setRollingStockValues: (
    rollingStockValue: React.SetStateAction<RollingStockParametersValues>
  ) => void;
};

type RollingStockEditorParameterFormColumnProps = RollingStockEditorParameterFormProps & {
  lastNonZeroMass: MultiUnitsParameter;
  setLastNonZeroMass: (lastNonZeroMass: React.SetStateAction<MultiUnitsParameter>) => void;
};

// TODO: make the conditional return clearer
const RollingStockEditorParameterFormColumn = ({
  rollingStockValues,
  setRollingStockValues,
  lastNonZeroMass,
  setLastNonZeroMass,
  propertiesList,
}: RollingStockEditorParameterFormColumnProps & {
  propertiesList: SchemaProperty[];
}) => {
  const { t } = useTranslation('translation', { keyPrefix: 'rollingStock' });

  /** Handle change in value or unit in a multiunit input */
  const handleMultiUnitParamChange = <U extends MultiUnit>(
    option: InputGroupSNCFValue<U>,
    property: SchemaProperty
  ) => {
    const selectedParam = rollingStockValues[property.title] as MultiUnitsParameter;

    const updatedSelectedParam = {
      min: handleUnitValue(option, selectedParam, lastNonZeroMass, 'min'),
      max: handleUnitValue(option, selectedParam, lastNonZeroMass, 'max'),
      unit: option.unit,
      value: handleUnitValue(option, selectedParam, lastNonZeroMass),
    } as MultiUnitsParameter;

    // If the mass has changed, we need to update the min and max of parameters expressed in mass dependent units.
    // Undefined or zero value for the mass however would render the conversion meaningless or lose information.
    let massDependentParams: Partial<RollingStockParametersValues> = {};
    if (property.title === 'mass' && updatedSelectedParam.value) {
      massDependentParams = Object.fromEntries(
        Object.entries(rollingStockValues)
          .filter(
            ([_, curParam]) => isMultiUnitsParam(curParam) && isMassDependentUnit(curParam.unit)
            // TODO : investigate how curParam.unit can be undefined at runtime despite being defined according to typing
          )
          .map(([curPropertyTitle, massDependentParam]) => [
            curPropertyTitle,
            rescaleMassDependentParam(
              massDependentParam as MultiUnitsParameter,
              lastNonZeroMass,
              updatedSelectedParam
            ),
          ])
      );
      setLastNonZeroMass(updatedSelectedParam);
    }

    setRollingStockValues({
      ...rollingStockValues,
      ...massDependentParams,
      [property.title]: updatedSelectedParam,
    });
  };

  return (
    <>
      {propertiesList.map((property, index, arr) => {
        const isLast = index === arr.length - 1;
        const label = t(property.title as RollingStockEditorParameter);

        if (property.type === 'select' && property.enum) {
          return (
            <div
              className={cx(
                'd-flex',
                'align-items-center',
                'justify-content-between',
                'rollingstock-editor-select',
                'mb-4',
                { 'mb-xl-0': isLast }
              )}
              key={index}
            >
              <SelectSNCF
                sm
                id={property.title}
                name={property.title}
                label={label}
                // with an enum, type is a string
                value={rollingStockValues[property.title] as string}
                options={property.enum}
                onChange={(value?: string) => {
                  setRollingStockValues({
                    ...rollingStockValues,
                    [property.title]: value || null,
                  });
                }}
              />
            </div>
          );
        }
        if (property.units) {
          const currentParam = rollingStockValues[property.title] as MultiUnitsParameter;

          return (
            <div
              className={cx(
                'form-control-container',
                ' justify-content-between',
                property.margin || 'mb-4',
                {
                  'd-flex align-items-center':
                    property.title === 'mass' || property.title === 'maxSpeed',
                  'mb-xl-0': isLast,
                }
              )}
              key={index}
            >
              <InputGroupSNCF
                id={property.title}
                inputDataTestId={`${property.title}-input`}
                label={label}
                currentValue={{
                  unit: currentParam.unit,
                  value: currentParam.value,
                }}
                options={property.units.map((unit) => ({
                  id: unit,
                  label: unit,
                }))}
                onChange={(option) => handleMultiUnitParamChange(option, property)}
                min={currentParam.min}
                max={currentParam.max}
                isInvalid={
                  currentParam.value === undefined ||
                  currentParam.value < currentParam.min ||
                  currentParam.value > currentParam.max
                }
                errorMsg={t('errorMessages.minMaxRangeError', {
                  min: currentParam.min?.toString().replace('.', ','),
                  max: floor(currentParam.max, 6).toString().replace('.', ','),
                })}
              />
            </div>
          );
        }
        return (
          <InputSNCF
            containerClass="col-6 px-0"
            noMargin={isLast}
            id={property.title}
            name={property.title}
            label={property.title in RS_REQUIRED_FIELDS ? `${label}\u00a0*` : label}
            type={property.type}
            step="any"
            min={property.min}
            max={property.max}
            isInvalid={
              property.type === 'number' &&
              (Number.isNaN(rollingStockValues[property.title]) ||
                (rollingStockValues[property.title] as number) < property.min! ||
                (rollingStockValues[property.title] as number) > property.max!)
            }
            errorMsg={
              property.max
                ? t('errorMessages.minMaxRangeError', {
                    min: property.min?.toString().replace('.', ','),
                    max: property.max?.toString().replace('.', ','),
                  })
                : t('errorMessages.minRangeError', {
                    min: property.min?.toString().replace('.', ','),
                  })
            }
            unit={property.unit}
            value={
              !isNil(rollingStockValues[property.title])
                ? (rollingStockValues[property.title] as string | number)
                : ''
            }
            onChange={({ target: { value } }) => {
              let newValue: string | number | undefined = value;
              if (property.title !== 'basePowerClass') {
                newValue = value !== '' ? Number(value) : undefined;
              }
              setRollingStockValues({
                ...rollingStockValues,
                [property.title]: newValue,
              });
            }}
            sm
            isFlex
            key={index}
            {...(property.type === 'number' ? { textRight: true } : {})}
          />
        );
      })}
    </>
  );
};

const RollingStockEditorParameterForm = ({
  rollingStockValues,
  setRollingStockValues,
  effortCurves,
}: RollingStockEditorParameterFormProps & {
  effortCurves: EffortCurveForms | null;
}) => {
  const { t } = useTranslation('translation', { keyPrefix: 'rollingStock' });
  // The mass is sets by default to its min for a new rolling stock, so it should always be defined on first render
  const [lastNonZeroMass, setLastNonZeroMass] = useState(rollingStockValues.mass!);
  const refListOfProperties = Object.keys(RollingStockEditorParameter);

  const {
    left: leftSideList,
    middle: middleSideList,
    right: rightSideList,
  } = splitRollingStockProperties(refListOfProperties, effortCurves);

  return (
    <div className="d-xl-flex justify-content-center px-1 pb-3">
      <div className="col-xl-4 rollingstock-editor-input-container mb-3">
        <RollingStockEditorParameterFormColumn
          rollingStockValues={rollingStockValues}
          setRollingStockValues={setRollingStockValues}
          propertiesList={leftSideList}
          lastNonZeroMass={lastNonZeroMass}
          setLastNonZeroMass={setLastNonZeroMass}
        />
      </div>
      <div className="col-xl-4 rollingstock-editor-input-container mb-3">
        <RollingStockEditorParameterFormColumn
          rollingStockValues={rollingStockValues}
          setRollingStockValues={setRollingStockValues}
          propertiesList={middleSideList}
          lastNonZeroMass={lastNonZeroMass}
          setLastNonZeroMass={setLastNonZeroMass}
        />
      </div>
      <div className="d-flex flex-column justify-content-between col-xl-4 pb-3">
        <div className="d-flex flex-xl-column mb-2 mt-3 mt-xl-0">
          <span className="ml-xl-2 text-gray-dark">{t('rollingResistance')}</span>
          <span className="ml-4 text-muted">{t('rollingResistanceFormula')}</span>
        </div>
        <RollingStockEditorParameterFormColumn
          rollingStockValues={rollingStockValues}
          setRollingStockValues={setRollingStockValues}
          propertiesList={rightSideList}
          lastNonZeroMass={lastNonZeroMass}
          setLastNonZeroMass={setLastNonZeroMass}
        />
      </div>
    </div>
  );
};

export default RollingStockEditorParameterForm;
