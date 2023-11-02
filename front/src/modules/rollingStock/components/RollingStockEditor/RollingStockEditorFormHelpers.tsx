import React, { SetStateAction } from 'react';
import { useTranslation } from 'react-i18next';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import InputGroupSNCF from 'common/BootstrapSNCF/InputGroupSNCF';
import SelectSNCF from 'common/BootstrapSNCF/SelectSNCF';
import {
  RollingStockEditorMetadata,
  RollingStockEditorParameter,
  RollingStockParametersValues,
  RollingStockSchemaProperties,
} from 'modules/rollingStock/consts';

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
      ).map((property, index) => (
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
};

// TODO: make the conditional return clearer
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
      ).map((property, index) => {
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
                rollingStockValues[property.title] !== undefined
                  ? (rollingStockValues[property.title] as string | number)
                  : ''
              }
              options={property.units.map((unit) => ({
                id: `${property.title}-${unit}`,
                label: unit,
              }))}
              handleType={(type) => {
                setRollingStockValues({
                  ...rollingStockValues,
                  [property.title]: type.value !== '' ? Number(type.value) : undefined,
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
              textRight
              disableUnitSelector
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
              rollingStockValues[property.title] !== undefined
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
        />
      </div>
      <div className="col-lg-4 rollingstock-editor-input-container">
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
