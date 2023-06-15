import React from 'react';
import { openapiSchemaToJsonSchema } from '@openapi-contrib/openapi-schema-to-json-schema';
import {
  FieldValues,
  Resolver,
  SubmitHandler,
  UseFormProps,
  UseFormRegister,
  useForm,
} from 'react-hook-form';
import { fullFormats } from 'ajv-formats/dist/formats';
import { ajvResolver } from '@hookform/resolvers/ajv';
import { useTranslation } from 'react-i18next';
import { BiErrorCircle } from 'react-icons/bi';
import {
  LightRollingStock,
  PostRollingStockApiArg,
  osrdEditoastApi,
} from 'common/api/osrdEditoastApi';
import { useModal } from 'common/BootstrapSNCF/ModalSNCF';
import { useDispatch } from 'react-redux';
import { setFailure, setSuccess } from 'reducers/main';
import RollingStockBaseOpenapiSchema from '../json/RollingStockBaseOpenapiSchema.json';
import RollingStockEditorFormModal from './RollingStockEditorFormModal';
import {
  Metadata,
  Parameter,
  RollingStockParametersValues,
  RollingStockResistance,
  sideValue,
} from '../consts';

type RollingStockEditorElementsProps = {
  label: string;
  options?: string[];
  position?: boolean;
  error: string;
  register: UseFormRegister<FieldValues>;
};

export const RollingStockEditorInput = ({
  label,
  position,
  error,
  register,
}: RollingStockEditorElementsProps) => {
  const { t } = useTranslation('rollingStockEditor');
  return (
    <div
      className={`d-flex ${
        !position && 'rollingstock-editor-input'
      } justify-content-between align-items-center mb-2`}
    >
      <label
        className={`text-primary col-8 ${position && 'rollingstock-editor-input-label'} my-0`}
        htmlFor={label}
      >
        {error && (
          <div className="text-yellow">
            <BiErrorCircle />
          </div>
        )}
        <span className={!position ? 'right-side' : ''}>{t(label)}</span>
      </label>
      <input
        id={label}
        className={`form-control-sm bg-white px-2 ${
          !position && RollingStockResistance[label as RollingStockResistance] ? 'col-3' : 'col-4'
        }`}
        {...register(label)}
      />
      {!position && RollingStockResistance[label as RollingStockResistance] && (
        <div className="col-1 text-center mr-1">
          {label.substring(label.length - 1, label.length).toLocaleLowerCase()}:
        </div>
      )}
    </div>
  );
};

export const RollingStockEditorSelect = ({
  label,
  position,
  options,
  error,
  register,
}: RollingStockEditorElementsProps) => {
  const { t } = useTranslation('rollingStockEditor');
  return (
    <div
      className={`d-flex flex-row${
        position ? '' : '-reverse'
      } justify-content-between align-items-center  mb-2`}
    >
      <label className={`text-primary col-8 ${position ? 'mr-2' : 'ml-2'} my-0`} htmlFor={label}>
        {error && (
          <div className="text-yellow">
            <BiErrorCircle />
          </div>
        )}
        {t(label)}
      </label>
      <select id={label} className="form-control-sm col-4" {...register(label)}>
        {options?.map((option: string) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
};

type RollingStockParametersProps = {
  rollingStockData?: LightRollingStock;
  isAdding?: boolean;
  setIsEditing: React.Dispatch<React.SetStateAction<boolean>>;
  setIsAdding?: React.Dispatch<React.SetStateAction<boolean>>;
};

const RollingStockEditorForm = ({
  rollingStockData,
  isAdding,
  setIsEditing,
  setIsAdding,
}: RollingStockParametersProps) => {
  const { t } = useTranslation('rollingStockEditor');
  const { openModal } = useModal();
  const jsonSchema = openapiSchemaToJsonSchema(RollingStockBaseOpenapiSchema);
  const schema = jsonSchema.components.schemas.RollingStockBase;

  const dispatch = useDispatch();

  const [postRollingstock] = osrdEditoastApi.usePostRollingStockMutation();

  // here we generate the resolver for the form validation
  const resolver = ajvResolver(schema, {
    formats: fullFormats,
    coerceTypes: true,
  });

  // here we generate the hook to set the entire form with a register for each field
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RollingStockParametersValues>({
    resolver: resolver as Resolver<RollingStockParametersValues, unknown>,
    defaultValues: {
      name: rollingStockData?.name || '',
      version: rollingStockData?.version || '',
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
      mass: rollingStockData?.mass || 0,
      max_speed: rollingStockData?.max_speed || 0,
      startup_time: rollingStockData?.startup_time || 0,
      startup_acceleration: rollingStockData?.startup_acceleration || 0,
      comfort_acceleration: rollingStockData?.comfort_acceleration || 0,
      gamma_value: rollingStockData?.gamma.value || 0,
      inertia_coefficient: rollingStockData?.inertia_coefficient || 0,
      loading_gauge: (rollingStockData?.loading_gauge as string) || 'G1',
      rolling_resistance_A: rollingStockData?.rolling_resistance.A || 0,
      rolling_resistance_B: rollingStockData?.rolling_resistance.B || 0,
      rolling_resistance_C: rollingStockData?.rolling_resistance.C || 0,
      electrical_power_startup_time: rollingStockData?.electrical_power_startup_time || null,
      raise_pantograph_time: rollingStockData?.raise_pantograph_time || null,
      default_mode: rollingStockData?.effort_curves.default_mode || 'thermal',
      is_electric:
        rollingStockData?.effort_curves.modes[rollingStockData?.effort_curves.default_mode]
          .is_electric || false,
    },
  } as unknown as UseFormProps<RollingStockParametersValues>);

  // in the top of the form we display all the metadatas
  // the array is split in two to display the metadatas in two columns
  const metadataForm = (position: boolean, registerForm: UseFormRegister<FieldValues>) =>
    Object.keys(schema.properties)
      .filter(
        (property, index) =>
          property === Metadata[property as Metadata] && (position ? index <= 5 : index > 5)
      )
      .map((property) => (
        <div key={property}>
          <RollingStockEditorInput
            label={property}
            register={registerForm}
            position={position}
            error={errors[property] as string}
          />
        </div>
      ));

  // in the left side of the form, under the metadatas, we display all the information except the rollingStock resistance params,
  // which are displayed in the right part of the form
  const parameterForm = (position: boolean, registerForm: UseFormRegister<FieldValues>) =>
    Object.keys(schema.properties)
      .filter((property) => Parameter[property as Parameter])
      .filter((property) =>
        position
          ? !RollingStockResistance[property as RollingStockResistance]
          : RollingStockResistance[property as RollingStockResistance]
      )
      .map((property) => (
        <div className="d-flex flex-column" key={property}>
          {schema.properties[property].enum ? (
            <RollingStockEditorSelect
              label={property}
              options={schema.properties[property]?.enum}
              register={registerForm}
              position={position}
              error={errors[property] as string}
            />
          ) : (
            <RollingStockEditorInput
              label={property}
              register={registerForm}
              position={position}
              error={errors[property] as string}
            />
          )}
        </div>
      ));

  const queryArg = (data: FieldValues): PostRollingStockApiArg => ({
    locked: false,
    rollingStockUpsertPayload: {
      version: data.version,
      name: data.name,
      length: data.length,
      max_speed: data.max_speed,
      startup_time: data.startup_time,
      startup_acceleration: data.startup_acceleration,
      comfort_acceleration: data.comfort_acceleration,
      gamma: {
        type: 'CONST',
        value: data.gamma_value,
      },
      inertia_coefficient: data.inertia_coefficient,
      features: [''],
      mass: data.mass,
      rolling_resistance: {
        A: data.rolling_resistance_A,
        B: data.rolling_resistance_B,
        C: data.rolling_resistance_C,
        type: 'davis',
      },
      loading_gauge: data.loading_gauge,
      base_power_class: '',
      power_restrictions: {},
      energy_sources: [],
      electrical_power_startup_time: data.electrical_power_startup_time,
      raise_pantograph_time: data.raise_pantograph_time,
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
        default_mode: data.default_mode,
        modes: {
          thermal: {
            is_electric: data.is_electric,
            curves: [],
            default_curve: {
              speeds: [],
              max_efforts: [],
            },
          },
        },
      },
    },
  });

  const addNewRollingstock = (data: FieldValues) => {
    postRollingstock(queryArg(data))
      .unwrap()
      .then(() => {
        dispatch(
          setSuccess({
            title: t('messages.success'),
            text: t('messages.rollingStockAdded'),
          })
        );
      })
      .catch(() => {
        dispatch(
          setFailure({
            name: t('messages.failure'),
            message: t('messages.rollingStockNotAdded'),
          })
        );
      });
  };

  const submit: SubmitHandler<FieldValues> = (data: FieldValues) => {
    if (isAdding)
      openModal(
        <RollingStockEditorFormModal
          setIsEditing={setIsEditing}
          setIsAdding={setIsAdding as React.Dispatch<React.SetStateAction<boolean>>}
          data={data}
          request={addNewRollingstock}
          mainText={t('confirmAction')}
          buttonText={t('confirm')}
        />
      );
  };

  const cancel = () => {
    openModal(
      <RollingStockEditorFormModal
        setIsEditing={setIsEditing}
        setIsAdding={setIsAdding as React.Dispatch<React.SetStateAction<boolean>>}
        mainText={t('cancelAction')}
        buttonText={t('cancel')}
      />
    );
  };

  // TODO: use InputSNCF and InputGroupSNCF

  return (
    <form
      className="d-flex flex-column form-control rollingstock-editor bg-white"
      onSubmit={handleSubmit(submit)}
    >
      <div className="d-lg-flex justify-content-center mb-4">
        <div className="col-lg-6 mr-4">{metadataForm(sideValue.left, register)}</div>
        <div className="col-lg-6">{metadataForm(sideValue.right, register)}</div>
      </div>
      <div className="d-lg-flex justify-content-center">
        <div className="col-lg-6 mr-4">{parameterForm(sideValue.left, register)}</div>
        <div className="col-lg-6">
          <div className="d-flex flex-column mb-2">
            <span className=" ml-2 text-gray-dark">{t('rollingResistance')}</span>
            <span className=" ml-4 text-muted">{t('rollingResistanceFormula')}</span>
          </div>
          {parameterForm(sideValue.right, register)}
        </div>
      </div>
      <div className="d-flex justify-content-between align-items-center">
        {Object.keys(errors)[0] && (
          <div className="text-yellow">
            <BiErrorCircle />
            <span className="ml-1">{t(`errors.missingInformation`) as string}</span>
          </div>
        )}
        <div className="ml-auto">
          <button type="button" className="btn btn-secondary mr-2" onClick={() => cancel()}>
            {t('cancel')}
          </button>
          <button type="submit" className="btn btn-primary">
            {t('confirm')}
          </button>
        </div>
      </div>
    </form>
  );
};

export default RollingStockEditorForm;
