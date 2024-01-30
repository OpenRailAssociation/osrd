import React, { SetStateAction, useState } from 'react';
import {
  RollingStockEditorMetadata,
  RollingStockEditorParameter,
  RS_SCHEMA_PROPERTIES,
} from 'modules/rollingStock/consts';
import { isNil } from 'lodash';
import { useTranslation } from 'react-i18next';
import InputGroupSNCF, { InputGroupSNCFValue } from 'common/BootstrapSNCF/InputGroupSNCF';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import SelectSNCF from 'common/BootstrapSNCF/SelectSNCF';

import type { EffortCurveForms, RollingStockParametersValues } from 'modules/rollingStock/types';
import { convertUnit } from '../../helpers/utils';

type RollingStockMetadataFormProps = {
  rollingStockValues: RollingStockParametersValues;
  setRollingStockValues: (
    rollingStockValue: React.SetStateAction<RollingStockParametersValues>
  ) => void;
};

const RollingStockEditorMetadataFormColumn = ({
  formSide,
  rollingStockValues,
  setRollingStockValues,
}: RollingStockMetadataFormProps & { formSide: 'left' | 'middle' | 'right' }) => {
  const { t } = useTranslation(['rollingstock', 'translation']);

  return (
    <>
      {RS_SCHEMA_PROPERTIES.filter((property) => {
        const isInThisGroup =
          property.title ===
          RollingStockEditorMetadata[property.title as RollingStockEditorMetadata];
        const isOnThisSide = property.side === formSide;
        return isInThisGroup && isOnThisSide;
      }).map((property, index) => (
        <InputSNCF
          id={property.title}
          name={property.title}
          label={t(`${property.title}`)}
          type={property.type}
          value={rollingStockValues[property.title] as string | number}
          onChange={(e) =>
            setRollingStockValues({ ...rollingStockValues, [property.title]: e.target.value })
          }
          sm
          isFlex
          key={index}
        />
      ))}
    </>
  );
};

export const RollingStockEditorMetadataForm = ({
  rollingStockValues,
  setRollingStockValues,
}: RollingStockMetadataFormProps) => (
  <div className="d-lg-flex justify-content-center mb-2 px-1">
    <div className="col-lg-4 rollingstock-editor-input-container">
      <RollingStockEditorMetadataFormColumn
        formSide="left"
        rollingStockValues={rollingStockValues}
        setRollingStockValues={setRollingStockValues}
      />
    </div>
    <div className="col-lg-4 rollingstock-editor-input-container">
      <RollingStockEditorMetadataFormColumn
        formSide="middle"
        rollingStockValues={rollingStockValues}
        setRollingStockValues={setRollingStockValues}
      />
    </div>
    <div className="col-lg-4 rollingstock-editor-input-container">
      <RollingStockEditorMetadataFormColumn
        formSide="right"
        rollingStockValues={rollingStockValues}
        setRollingStockValues={setRollingStockValues}
      />
    </div>
  </div>
);

type RollingStockEditorParameterFormProps = {
  optionValue: string;
  rollingStockValues: RollingStockParametersValues;
  setOptionValue: (option: React.SetStateAction<string>) => void;
  setRollingStockValues: (
    rollingStockValue: React.SetStateAction<RollingStockParametersValues>
  ) => void;
  effortCurves: EffortCurveForms | null;
};

// TODO: make the conditional return clearer
const RollingStockEditorParameterFormColumn = ({
  formSide,
  optionValue,
  rollingStockValues,
  setOptionValue,
  setRollingStockValues,
  effortCurves,
}: RollingStockEditorParameterFormProps & { formSide: 'left' | 'middle' | 'right' }) => {
  const { t } = useTranslation(['rollingstock', 'translation']);

  const unitRemember: any = {};

  return (
    <>
      {RS_SCHEMA_PROPERTIES.filter((property) => {
        unitRemember[property.title] = property.unit;

        const isInThisGroup =
          property.title ===
          RollingStockEditorParameter[property.title as RollingStockEditorParameter];
        const isOnThisSide = property.side === formSide;
        const isDisplayed = property.condition ? property.condition(effortCurves) : true;
        return isInThisGroup && isOnThisSide && isDisplayed;
      }).map((property, index) => {
        if (property.enum) {
          return (
            <div
              className="d-flex align-items-center justify-content-between rollingstock-editor-select mb-4"
              key={index}
            >
              <SelectSNCF
                sm
                id={property.title}
                name={property.title}
                label={t(property.title).toString()}
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
        /**
         * if the property has units choices like tons, kilograms, N, daN or km/h , we display a selector that converts the value to the new unit
         */
        return property.units ? (
          <div
            className={`${
              property.title === 'mass' && 'd-flex align-items-center'
            } form-control-container mb-4`}
            key={index}
          >
            <InputGroupSNCF
              id={property.title}
              label={t(`${property.title}`)}
              typeValue={property.type}
              type={optionValue}
              value={
                !isNil(rollingStockValues[property.title])
                  ? (rollingStockValues[property.title] as string | number)
                  : ''
              }
              options={property.units.map((unit) => ({
                id: `${property.title}-${unit}`,
                label: unit,
              }))}
              handleUnit={(inputValue: InputGroupSNCFValue): void => {
                console.log('unit before', unitRemember[property.title]);

                /**
                 * during the change of the unit, we need to update the value of the input after a conversion.
                 * First, we should find what was the previously selected unit.
                 * Then we convert it.
                 */
                console.log('unité changée, handleUnit inputValue', inputValue);
                // split inputValue with a dash
                if (inputValue.type) {
                  const splitInputValue = inputValue.type.split('-');
                  const currentUnit = splitInputValue[splitInputValue.length - 1];
                  const oldValue = inputValue.value;
                  console.log('property', property);
                  console.log('oldValue', oldValue);
                  setRollingStockValues((previousRollingStockValues: any) => {
                    console.log('previous prev', previousRollingStockValues, currentUnit);
                    if (previousRollingStockValues[property.title]) {
                      // const currentUnit = previousRollingStockValues[property.title]!.unit;
                      console.log('currentUnit', currentUnit);
                    }
                    rollingStockValues[property.title] = inputValue.value
                      ? Number(inputValue.value)
                      : undefined;

                    return {
                      ...rollingStockValues,
                    };
                  });
                }

                setOptionValue(inputValue.type as string);
              }}
              min={property.min}
              max={property.max}
              isInvalid={
                rollingStockValues[property.title]?.toString().length === 0 ||
                (rollingStockValues[property.title] as number) < (property.min as number) ||
                (rollingStockValues[property.title] as number) > (property.max as number)
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
              step="any"
              sm
              condensed
              orientation="right"
              textRight
            />
          </div>
        ) : (
          <InputSNCF
            id={property.title}
            name={property.title}
            label={t(`${property.title}`)}
            type={property.type}
            step="any"
            min={property.min}
            max={property.max}
            isInvalid={
              property.type === 'number' &&
              (Number.isNaN(rollingStockValues[property.title]) ||
                (rollingStockValues[property.title] as number) < (property.min as number) ||
                (rollingStockValues[property.title] as number) > (property.max as number))
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
      })}{' '}
    </>
  );
};

export const RollingStockEditorParameterForm = ({
  optionValue,
  rollingStockValues,
  setOptionValue,
  setRollingStockValues,
  effortCurves,
}: RollingStockEditorParameterFormProps) => {
  const { t } = useTranslation(['rollingstock', 'translation']);
  return (
    <div className="d-lg-flex justify-content-center px-1 pb-3">
      <div className="col-lg-4 rollingstock-editor-input-container">
        <RollingStockEditorParameterFormColumn
          optionValue={optionValue}
          formSide="left"
          rollingStockValues={rollingStockValues}
          setOptionValue={setOptionValue}
          setRollingStockValues={setRollingStockValues}
          effortCurves={effortCurves}
        />
      </div>
      <div className="col-lg-4 rollingstock-editor-input-container">
        <RollingStockEditorParameterFormColumn
          optionValue={optionValue}
          formSide="middle"
          rollingStockValues={rollingStockValues}
          setOptionValue={setOptionValue}
          setRollingStockValues={setRollingStockValues}
          effortCurves={effortCurves}
        />
      </div>
      <div className="col-lg-4">
        <div className="d-flex flex-column mb-2">
          <span className=" ml-2 text-gray-dark">{t('rollingResistance')}</span>
          <span className=" ml-4 text-muted">{t('rollingResistanceFormula')}</span>
        </div>
        <RollingStockEditorParameterFormColumn
          optionValue={optionValue}
          formSide="right"
          rollingStockValues={rollingStockValues}
          setOptionValue={setOptionValue}
          setRollingStockValues={setRollingStockValues}
          effortCurves={effortCurves}
        />
      </div>
    </div>
  );
};
