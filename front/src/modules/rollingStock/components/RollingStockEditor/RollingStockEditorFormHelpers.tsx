import cx from 'classnames';
import { floor, isNil } from 'lodash';
import { useTranslation } from 'react-i18next';

import CheckboxRadioSNCF from 'common/BootstrapSNCF/CheckboxRadioSNCF';
import InputGroupSNCF, { type InputGroupSNCFValue } from 'common/BootstrapSNCF/InputGroupSNCF';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import SelectSNCF from 'common/BootstrapSNCF/SelectSNCF';
import {
  DEFAULT_SIGNALING_SYSTEMS,
  RollingStockEditorMetadata,
  RollingStockEditorParameter,
  RS_REQUIRED_FIELDS,
} from 'modules/rollingStock/consts';
import { handleUnitValue, splitRollingStockProperties } from 'modules/rollingStock/helpers/utils';
import useCompleteRollingStockSchemasProperties from 'modules/rollingStock/hooks/useCompleteRollingStockSchemasProperties';
import type {
  EffortCurveForms,
  MultiUnit,
  MultiUnitsParameter,
  RollingStockParametersValues,
  SchemaProperty,
} from 'modules/rollingStock/types';

type RollingStockMetadataFormProps = {
  rollingStockValues: RollingStockParametersValues;
  setRollingStockValues: (
    rollingStockValue: React.SetStateAction<RollingStockParametersValues>
  ) => void;
};

const RollingStockEditorMetadataFormColumn = ({
  propertiesList,
  rollingStockValues,
  setRollingStockValues,
}: RollingStockMetadataFormProps & { propertiesList: SchemaProperty[] }) => {
  const { t } = useTranslation(['rollingstock', 'translation']);
  return (
    <>
      {propertiesList.map((property, index) => (
        <InputSNCF
          containerClass="col-6 px-0"
          id={property.title}
          name={property.title}
          label={
            property.title in RS_REQUIRED_FIELDS ? `${t(property.title)} *` : t(property.title)
          }
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
}: RollingStockMetadataFormProps) => {
  const refListOfProperties = Object.keys(RollingStockEditorMetadata);
  const {
    left: leftSideList,
    middle: middleSideList,
    right: rightSideList,
  } = splitRollingStockProperties(refListOfProperties);

  return (
    <div className="d-xl-flex justify-content-center mb-2 px-1">
      <div className="col-xl-4 rollingstock-editor-input-container">
        <RollingStockEditorMetadataFormColumn
          propertiesList={leftSideList}
          rollingStockValues={rollingStockValues}
          setRollingStockValues={setRollingStockValues}
        />
      </div>
      <div className="col-xl-4 rollingstock-editor-input-container">
        <RollingStockEditorMetadataFormColumn
          propertiesList={middleSideList}
          rollingStockValues={rollingStockValues}
          setRollingStockValues={setRollingStockValues}
        />
      </div>
      <div className="col-xl-4 rollingstock-editor-input-container">
        <RollingStockEditorMetadataFormColumn
          propertiesList={rightSideList}
          rollingStockValues={rollingStockValues}
          setRollingStockValues={setRollingStockValues}
        />
      </div>
    </div>
  );
};

type RollingStockEditorParameterFormProps = {
  rollingStockValues: RollingStockParametersValues;
  setRollingStockValues: (
    rollingStockValue: React.SetStateAction<RollingStockParametersValues>
  ) => void;
};

// TODO: make the conditional return clearer
const RollingStockEditorParameterFormColumn = ({
  rollingStockValues,
  setRollingStockValues,
  propertiesList,
}: RollingStockEditorParameterFormProps & {
  propertiesList: SchemaProperty[];
}) => {
  const { t } = useTranslation(['rollingstock', 'translation']);

  const handleUnitChange = <U extends MultiUnit>(
    option: InputGroupSNCFValue<U>,
    property: SchemaProperty
  ) => {
    const selectedParam = rollingStockValues[property.title] as MultiUnitsParameter;

    setRollingStockValues({
      ...rollingStockValues,
      [property.title]: {
        min: handleUnitValue(option, selectedParam, rollingStockValues.mass, 'min'),
        max: handleUnitValue(option, selectedParam, rollingStockValues.mass, 'max'),
        unit: option.unit,
        value: handleUnitValue(option, selectedParam, rollingStockValues.mass),
      } as MultiUnitsParameter,
    });
  };

  return (
    <>
      {propertiesList.map((property, index, arr) => {
        const isLast = index === arr.length - 1;

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
                label={t(property.title)}
                currentValue={{
                  unit: currentParam.unit,
                  value: currentParam.value,
                }}
                options={property.units.map((unit) => ({
                  id: unit,
                  label: unit,
                }))}
                onChange={(option) => handleUnitChange(option, property)}
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
            label={
              property.title in RS_REQUIRED_FIELDS ? `${t(property.title)} *` : t(property.title)
            }
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
      })}
    </>
  );
};

export const RollingStockEditorParameterForm = ({
  rollingStockValues,
  setRollingStockValues,
  effortCurves,
}: RollingStockEditorParameterFormProps & {
  effortCurves: EffortCurveForms | null;
}) => {
  const { t } = useTranslation(['rollingstock', 'translation']);
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
        />
      </div>
      <div className="col-xl-4 rollingstock-editor-input-container mb-3">
        <RollingStockEditorParameterFormColumn
          rollingStockValues={rollingStockValues}
          setRollingStockValues={setRollingStockValues}
          propertiesList={middleSideList}
        />
      </div>
      <div className="d-flex flex-column justify-content-between col-xl-4 pb-3">
        <div className="d-flex flex-xl-column mb-2 mt-3 mt-xl-0">
          <span className=" ml-xl-2 text-gray-dark">{t('rollingResistance')}</span>
          <span className=" ml-4 text-muted">{t('rollingResistanceFormula')}</span>
        </div>
        <RollingStockEditorParameterFormColumn
          rollingStockValues={rollingStockValues}
          setRollingStockValues={setRollingStockValues}
          propertiesList={rightSideList}
        />
      </div>
    </div>
  );
};

type RollingStockEditorOnboardSystemEquipmentFormProps = {
  rsSignalingSystemsList: RollingStockParametersValues['supportedSignalingSystems'];
  setRollingStockValues: (
    rollingStockValues: React.SetStateAction<RollingStockParametersValues>
  ) => void;
};

export const RollingStockEditorOnboardSystemEquipmentForm = ({
  rsSignalingSystemsList,
  setRollingStockValues,
}: RollingStockEditorOnboardSystemEquipmentFormProps) => {
  const { t } = useTranslation(['rollingstock']);

  const rollingStockSchemasProperties = useCompleteRollingStockSchemasProperties();

  const sigSystemProperty = rollingStockSchemasProperties.filter(
    (property) => property.title === 'supportedSignalingSystems'
  )[0];

  const updateSigSystemsList = (sigSystem: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const newList = e.target.checked
      ? [...rsSignalingSystemsList, sigSystem]
      : rsSignalingSystemsList.filter((v) => v !== sigSystem);
    setRollingStockValues((prevRollingStockValues) => ({
      ...prevRollingStockValues,
      supportedSignalingSystems: newList,
    }));
  };

  const signalingSystemCheckboxes = sigSystemProperty.enum!.map((sigSystem, index) => {
    const checked = rsSignalingSystemsList.includes(sigSystem);
    return (
      <div key={`${index}-${sigSystem}`} className={cx('col-6', 'col-xl-3')}>
        <CheckboxRadioSNCF
          type="checkbox"
          id={sigSystem}
          name={sigSystem}
          label={sigSystem}
          checked={checked}
          onChange={updateSigSystemsList(sigSystem)}
          disabled={DEFAULT_SIGNALING_SYSTEMS.includes(sigSystem)}
        />
      </div>
    );
  });

  return (
    <div className="d-lg-flex rollingstock-editor-input-container px-1 pb-3">
      <div className={cx('d-flex', 'justify-content-space-around', 'mr-2')}>
        <label className="signaling-systems-label col-xl-3" htmlFor="supportedSignalingSystems">
          {t('supportedSignalingSystems')}
        </label>
        <div className="d-flex flex-wrap col-xl-9 ">{signalingSystemCheckboxes}</div>
      </div>
    </div>
  );
};
