import React, { SetStateAction } from 'react';
import { useTranslation } from 'react-i18next';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import InputGroupSNCF, { InputGroupSNCFValue } from 'common/BootstrapSNCF/InputGroupSNCF';
import SelectSNCF from 'common/BootstrapSNCF/SelectSNCF';
import {
  RollingStockEditorMetadata,
  RollingStockEditorParameter,
  RollingStockParametersValues,
  RollingStockSchemaProperties,
} from 'applications/rollingStockEditor/consts';

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
      {RollingStockSchemaProperties.filter(
        (property) =>
          property.title ===
            RollingStockEditorMetadata[property.title as RollingStockEditorMetadata] &&
          property.side === formSide
      ).map((property) => (
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
          key={property.title}
        />
      ))}
    </>
  );
};

export const RollingStockEditorMetadataForm = ({
  rollingStockValues,
  setRollingStockValues,
}: RollingStockMetadataFormProps) => (
  <div className="d-lg-flex justify-content-center mb-4 px-1">
    <div className="col-lg-4 mr-4 rollingstock-editor-input-container">
      <RollingStockEditorMetadataFormColumn
        formSide="left"
        rollingStockValues={rollingStockValues}
        setRollingStockValues={setRollingStockValues}
      />
    </div>
    <div className="col-lg-4 mr-4 rollingstock-editor-input-container">
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
};

const RollingStockEditorParameterFormColumn = ({
  formSide,
  optionValue,
  rollingStockValues,
  setOptionValue,
  setRollingStockValues,
}: RollingStockEditorParameterFormProps & { formSide: 'left' | 'middle' | 'right' }) => {
  const { t } = useTranslation(['rollingstock', 'translation']);
  return (
    <>
      {RollingStockSchemaProperties.filter(
        (property) =>
          property.title ===
            RollingStockEditorParameter[property.title as RollingStockEditorParameter] &&
          property.side === formSide
      ).map((property) => {
        if (property.enum) {
          return (
            <div className="d-flex align-items-center justify-content-between rollingstock-editor-select">
              <SelectSNCF
                id={property.title}
                name={property.title}
                title={t(`${property.title}`)}
                labelKey="label"
                value={JSON.stringify({
                  label: rollingStockValues[property.title],
                  value: rollingStockValues[property.title],
                } as InputGroupSNCFValue)}
                options={property.enum.map((option) => ({
                  label: option,
                  value: option,
                }))}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  setRollingStockValues({
                    ...rollingStockValues,
                    [property.title]: JSON.parse(e.target.value).value,
                  });
                }}
                sm
                key={property.title}
              />
            </div>
          );
        }
        return property.units ? (
          <div
            className={`${
              property.title === 'mass' && 'd-flex align-items-center'
            } form-control-container mb-4`}
          >
            <InputGroupSNCF
              id={property.title}
              label={t(`${property.title}`)}
              typeValue={property.type}
              type={optionValue}
              value={rollingStockValues[property.title] as string | number}
              options={property.units.map((unit) => ({
                id: `${property.title}-${unit}`,
                label: unit,
              }))}
              handleType={(type) => {
                setRollingStockValues({
                  ...rollingStockValues,
                  [property.title]: type.value,
                } as SetStateAction<RollingStockParametersValues>);
                setOptionValue(type.type as string);
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
              Number.isNaN(rollingStockValues[property.title]) ||
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
            unit={property.unit}
            value={rollingStockValues[property.title] as number}
            onChange={(e) =>
              setRollingStockValues({
                ...rollingStockValues,
                [property.title]: parseFloat(e.target.value),
              })
            }
            sm
            isFlex
            key={property.title}
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
}: RollingStockEditorParameterFormProps) => {
  const { t } = useTranslation(['rollingstock', 'translation']);
  return (
    <div className="d-lg-flex justify-content-center px-1">
      <div className="col-lg-4 mr-4 rollingstock-editor-input-container">
        <RollingStockEditorParameterFormColumn
          optionValue={optionValue}
          formSide="left"
          rollingStockValues={rollingStockValues}
          setOptionValue={setOptionValue}
          setRollingStockValues={setRollingStockValues}
        />
      </div>
      <div className="col-lg-4 mr-4 rollingstock-editor-input-container">
        <RollingStockEditorParameterFormColumn
          optionValue={optionValue}
          formSide="middle"
          rollingStockValues={rollingStockValues}
          setOptionValue={setOptionValue}
          setRollingStockValues={setRollingStockValues}
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
        />
      </div>
    </div>
  );
};
