import React, { SetStateAction, useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { RollingStock, osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { useModal } from 'common/BootstrapSNCF/ModalSNCF';
import { useDispatch } from 'react-redux';
import { setFailure, setSuccess } from 'reducers/main';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import InputGroupSNCF, { InputGroupSNCFValue } from 'common/BootstrapSNCF/InputGroupSNCF';
import SelectSNCF from 'common/BootstrapSNCF/SelectSNCF';
import RollingStockEditorFormModal from './RollingStockEditorFormModal';
import {
  RollingStockEditorMetadata,
  RollingStockEditorParameter,
  RollingStockParametersValues,
  RollingStockschemaProperties,
  SchemaProperty,
} from '../consts';
import RollingStockEditorCurves from './RollingStockEditorCurves';
import getRollingStockEditorDefaultValues, {
  getDefaultRollingStockMode,
  rollingStockEditorQueryArg,
} from '../utils';

type RollingStockParametersProps = {
  rollingStockData?: RollingStock;
  setAddOrEditState: React.Dispatch<React.SetStateAction<boolean>>;
  isAdding?: boolean;
};

const RollingStockEditorForm = ({
  rollingStockData,
  setAddOrEditState,
  isAdding,
}: RollingStockParametersProps) => {
  const { t } = useTranslation(['rollingstock', 'translation']);
  const { openModal } = useModal();
  const dispatch = useDispatch();
  const [postRollingstock] = osrdEditoastApi.usePostRollingStockMutation();
  const [patchRollingStock] = osrdEditoastApi.usePatchRollingStockByIdMutation();

  const [isCurrentEffortCurveDefault, setIsCurrentEffortCurveDefault] = useState<boolean>(true);
  const [isValid, setIsValid] = useState<boolean>(true);
  const [optionValue, setOptionValue] = useState<string>('');

  const selectedMode = rollingStockData
    ? Object.keys(rollingStockData.effort_curves.modes)[0]
    : 'thermal';

  const defaultRollingStockMode = useMemo(
    () => getDefaultRollingStockMode(selectedMode),
    [selectedMode]
  );

  const [currentRsEffortCurve, setCurrentRsEffortCurve] =
    useState<RollingStock['effort_curves']>(defaultRollingStockMode);

  const defaultValues: RollingStockParametersValues = useMemo(
    () => getRollingStockEditorDefaultValues(selectedMode, rollingStockData),
    [rollingStockData, selectedMode, defaultRollingStockMode]
  );

  const [rollingStockValues, setRollingStockValues] = useState(defaultValues);

  const metadataForm = (data: SchemaProperty[]) =>
    data
      .filter(
        (property) =>
          property.title ===
          RollingStockEditorMetadata[property.title as RollingStockEditorMetadata]
      )
      .map((property) => (
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
      ));

  const parameterForm = (data: SchemaProperty[]) =>
    data
      .filter(
        (property) =>
          property.title ===
          RollingStockEditorParameter[property.title as RollingStockEditorParameter]
      )
      .map((property) => {
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
      });

  const addNewRollingstock = (data: RollingStockParametersValues) => () => {
    const queryArg = rollingStockEditorQueryArg(data, selectedMode, currentRsEffortCurve, isAdding);
    postRollingstock({
      locked: false,
      rollingStockUpsertPayload: queryArg,
    })
      .unwrap()
      .then(() => {
        dispatch(
          setSuccess({
            title: t('messages.success'),
            text: t('messages.rollingStockAdded'),
          })
        );
        setAddOrEditState(false);
      })
      .catch((error) => {
        if (error.data?.message.includes('duplicate')) {
          dispatch(
            setFailure({
              name: t('messages.failure'),
              message: t('messages.rollingStockDuplicateName'),
            })
          );
        } else {
          dispatch(
            setFailure({
              name: t('messages.failure'),
              message: t('messages.rollingStockNotAdded'),
            })
          );
        }
      });
  };

  const updateRollingStock = (data: RollingStockParametersValues) => () => {
    const queryArg = rollingStockEditorQueryArg(data, selectedMode, currentRsEffortCurve);
    if (rollingStockData) {
      patchRollingStock({
        id: rollingStockData?.id as number,
        rollingStockUpsertPayload: queryArg,
      })
        .unwrap()
        .then(() => {
          dispatch(
            setSuccess({
              title: t('messages.success'),
              text: t('messages.rollingStockAdded'),
            })
          );
          setAddOrEditState(false);
        })
        .catch((error) => {
          if (error.data?.message.includes('used')) {
            dispatch(
              setFailure({
                name: t('messages.failure'),
                message: t('messages.rollingStockDuplicateName'),
              })
            );
          } else {
            dispatch(
              setFailure({
                name: t('messages.failure'),
                message: t('messages.rollingStockNotUpdated'),
              })
            );
          }
        });
    }
  };

  const submit = (e: React.FormEvent<HTMLFormElement>, data: RollingStockParametersValues) => {
    e.preventDefault();
    openModal(
      <RollingStockEditorFormModal
        setAddOrEditState={setAddOrEditState}
        request={isAdding ? addNewRollingstock(data) : updateRollingStock(data)}
        mainText={t('confirmAction')}
        buttonText={t('translation:common.confirm')}
      />
    );
  };

  const cancel = () => {
    openModal(
      <RollingStockEditorFormModal
        setAddOrEditState={setAddOrEditState}
        mainText={t('cancelAction')}
        buttonText={t('translation:common.cancel')}
      />
    );
  };

  useEffect(() => {
    setIsValid(true);
    RollingStockschemaProperties.forEach((property) => {
      if (
        (property.title ===
          RollingStockEditorParameter[property.title as RollingStockEditorParameter] &&
          Number.isNaN(rollingStockValues[property.title])) ||
        (rollingStockValues[property.title] as number) < (property.min as number) ||
        (rollingStockValues[property.title] as number) > (property.max as number)
      ) {
        setIsValid(false);
      }
    });
  }, [rollingStockValues]);

  useEffect(() => {
    if (rollingStockData) {
      setCurrentRsEffortCurve(rollingStockData.effort_curves);
      setIsCurrentEffortCurveDefault(false);
    }
  }, [rollingStockData]);

  return (
    <form
      className="d-flex flex-column form-control rollingstock-editor-form bg-white"
      onSubmit={(e) => submit(e, rollingStockValues)}
    >
      <div className="d-lg-flex justify-content-center mb-4 px-1">
        <div className="col-lg-4 mr-4 rollingstock-editor-input-container">
          {metadataForm(
            RollingStockschemaProperties.filter((schemaProperty) => schemaProperty.side === 'left')
          )}
        </div>
        <div className="col-lg-4 mr-4 rollingstock-editor-input-container">
          {metadataForm(
            RollingStockschemaProperties.filter(
              (schemaProperty) => schemaProperty.side === 'middle'
            )
          )}
        </div>
        <div className="col-lg-4 rollingstock-editor-input-container">
          {metadataForm(
            RollingStockschemaProperties.filter((schemaProperty) => schemaProperty.side === 'right')
          )}
        </div>
      </div>
      <div className="d-lg-flex justify-content-center px-1">
        <div className="col-lg-4 mr-4 rollingstock-editor-input-container">
          {parameterForm(
            RollingStockschemaProperties.filter((schemaProperty) => schemaProperty.side === 'left')
          )}
        </div>
        <div className="col-lg-4 mr-4 rollingstock-editor-input-container">
          {parameterForm(
            RollingStockschemaProperties.filter(
              (schemaProperty) => schemaProperty.side === 'middle'
            )
          )}
        </div>
        <div className="col-lg-4">
          <div className="d-flex flex-column mb-2">
            <span className=" ml-2 text-gray-dark">{t('rollingResistance')}</span>
            <span className=" ml-4 text-muted">{t('rollingResistanceFormula')}</span>
          </div>
          {parameterForm(
            RollingStockschemaProperties.filter((schemaProperty) => schemaProperty.side === 'right')
          )}
        </div>
      </div>
      {rollingStockData && !isCurrentEffortCurveDefault && (
        <RollingStockEditorCurves
          data={rollingStockData}
          currentRsEffortCurve={currentRsEffortCurve}
          setCurrentRsEffortCurve={setCurrentRsEffortCurve}
        />
      )}
      {!rollingStockData && (
        <RollingStockEditorCurves
          currentRsEffortCurve={currentRsEffortCurve}
          setCurrentRsEffortCurve={setCurrentRsEffortCurve}
        />
      )}
      <div className="d-flex justify-content-between align-items-center">
        <div className="ml-auto my-2 pr-3 rollingstock-editor-submit">
          <button
            type="button"
            className="btn btn-secondary mr-2 py-1 px-2"
            onClick={() => cancel()}
          >
            {t('translation:common.cancel')}
          </button>
          <button type="submit" className="btn btn-primary py-1 px-2" disabled={!isValid}>
            {t('translation:common.confirm')}
          </button>
        </div>
      </div>
    </form>
  );
};

export default RollingStockEditorForm;
