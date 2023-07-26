import React, { SetStateAction, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  RollingStock,
  osrdEditoastApi,
  RollingStockUpsertPayload,
  EffortCurve,
} from 'common/api/osrdEditoastApi';
import { useModal } from 'common/BootstrapSNCF/ModalSNCF';
import { useDispatch } from 'react-redux';
import { setFailure, setSuccess } from 'reducers/main';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import InputGroupSNCF, { InputGroupSNCFValue } from 'common/BootstrapSNCF/InputGroupSNCF';
import SelectSNCF from 'common/BootstrapSNCF/SelectSNCF';
import schema from '../json/rollingStockEditorData.json';
import RollingStockEditorFormModal from './RollingStockEditorFormModal';
import { Metadata, Parameter, RollingStockParametersValues, SchemaProperty } from '../consts';
import RollingStockEditorCurves from './RollingStockEditorCurves';

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

  const RollingStockschemaProperties = Object.values(schema) as SchemaProperty[];

  const [optionValue, setOptionValue] = useState<string>('');

  const [isCurrentEffortCurveDefault, setIsCurrentEffortCurveDefault] = useState<boolean>(true);
  const [isValid, setIsValid] = useState<boolean>(true);

  const selectedMode = rollingStockData
    ? Object.keys(rollingStockData.effort_curves.modes)[0]
    : 'thermal';

  const defaultRollingstockMode: RollingStock['effort_curves'] = {
    default_mode: selectedMode,
    modes: {
      [`${selectedMode}`]: {
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
        is_electric: false,
      },
    },
  };

  const [currentRsEffortCurve, setCurrentRsEffortCurve] =
    useState<RollingStock['effort_curves']>(defaultRollingstockMode);

  const defaultValues: RollingStockParametersValues = {
    railjsonVersion: rollingStockData?.railjson_version || '',
    name: rollingStockData?.name || '',
    detail: rollingStockData?.metadata.detail || '',
    family: rollingStockData?.metadata.family || '',
    grouping: rollingStockData?.metadata.grouping || '',
    number: rollingStockData?.metadata.number || '',
    reference: rollingStockData?.metadata.reference || '',
    series: rollingStockData?.metadata.series || '',
    subseries: rollingStockData?.metadata.subseries || '',
    type: rollingStockData?.metadata.type || '',
    unit: rollingStockData?.metadata.unit || '',
    length: rollingStockData?.length || 0,
    mass: rollingStockData ? rollingStockData.mass / 1000 : 0, // The mass received is in kg and should appear in tons.
    maxSpeed: rollingStockData ? rollingStockData.max_speed * 3.6 : 0, // The speed received is in m/s and should appear in km/h.
    startupTime: rollingStockData?.startup_time || 0,
    startupAcceleration: rollingStockData?.startup_acceleration || 0,
    comfortAcceleration: rollingStockData?.comfort_acceleration || 0.01,
    gammaValue: rollingStockData?.gamma.value || 0.01,
    inertiaCoefficient: rollingStockData?.inertia_coefficient || 1,
    loadingGauge: rollingStockData?.loading_gauge || 'G1',
    rollingResistanceA: rollingStockData?.rolling_resistance.A || 0,
    rollingResistanceB: rollingStockData?.rolling_resistance.B || 0,
    rollingResistanceC: rollingStockData?.rolling_resistance.C || 0,
    electricalPowerStartupTime: rollingStockData?.electrical_power_startup_time || null,
    raisePantographTime: rollingStockData?.raise_pantograph_time || null,
    defaultMode: rollingStockData?.effort_curves.default_mode || selectedMode,
    effortCurves: {
      modes: {
        [`${selectedMode}`]: {
          curves: defaultRollingstockMode.modes[`${selectedMode}`].curves,
          isElectric: defaultRollingstockMode.modes[`${selectedMode}`].is_electric,
          defaultCurve: defaultRollingstockMode.modes[`${selectedMode}`].default_curve,
        },
      },
    },
  };

  const [rollingStockValues, setRollingStockValues] =
    useState<RollingStockParametersValues>(defaultValues);

  const metadataForm = (data: SchemaProperty[]) =>
    data
      .filter((property) => property.title === Metadata[property.title as Metadata])
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
      .filter((property) => property.title === Parameter[property.title as Parameter])
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
                  ? t('errorMessages.minMaxRangeError', { min: property.min, max: property.max })
                  : t('errorMessages.minRangeError', { min: property.min })
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
                ? t('errorMessages.minMaxRangeError', { min: property.min, max: property.max })
                : t('errorMessages.minRangeError', { min: property.min })
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

  const queryArg = (data: RollingStockParametersValues): RollingStockUpsertPayload => ({
    railjson_version: data.railjsonVersion,
    name: data.name,
    length: data.length,
    max_speed: data.maxSpeed / 3.6, // The user enters a value in km/h, which is then interpreted in m/s by the server.
    startup_time: data.startupTime,
    startup_acceleration: data.startupAcceleration,
    comfort_acceleration: data.comfortAcceleration,
    gamma: {
      type: 'CONST',
      value: data.gammaValue,
    },
    inertia_coefficient: data.inertiaCoefficient,
    features: [],
    mass: data.mass * 1000, // Here we receive a value in ton which will be interpreted in kg by the server.
    rolling_resistance: {
      A: data.rollingResistanceA,
      B: data.rollingResistanceB,
      C: data.rollingResistanceC,
      type: 'davis',
    },
    loading_gauge: data.loadingGauge,
    base_power_class: '',
    power_restrictions: {},
    energy_sources: [],
    electrical_power_startup_time: data.electricalPowerStartupTime,
    raise_pantograph_time: data.raisePantographTime,
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
      default_mode: selectedMode,
      modes: {
        [`${selectedMode}`]: {
          curves: currentRsEffortCurve.modes[`${selectedMode}`].curves,
          is_electric: currentRsEffortCurve.modes[`${selectedMode}`].is_electric,
          default_curve: isAdding
            ? (currentRsEffortCurve.modes[`${selectedMode}`].curves[0].curve as EffortCurve)
            : currentRsEffortCurve.modes[`${selectedMode}`].default_curve,
        },
      },
    },
  });

  const addNewRollingstock = (data: RollingStockParametersValues) => {
    postRollingstock({
      locked: false,
      rollingStockUpsertPayload: queryArg(data),
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

  const updateRollingStock = (data: RollingStockParametersValues) => {
    if (rollingStockData) {
      patchRollingStock({
        id: rollingStockData?.id as number,
        rollingStockUpsertPayload: queryArg(data),
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
        data={data}
        request={isAdding ? addNewRollingstock : updateRollingStock}
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
        (property.title === Parameter[property.title as Parameter] &&
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
