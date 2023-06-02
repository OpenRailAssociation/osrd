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
import { LightRollingStock } from 'common/api/osrdEditoastApi';
import { useModal } from 'common/BootstrapSNCF/ModalSNCF';
import RollingStockBaseOpenapiSchema from '../json/RollingStockBaseOpenapiSchema.json';
import RollingStockEditorFormModal from './RollingStockEditorFormModal';

type RollingStockParametersValues = {
  [key: number | string]: {
    startup_time: number;
    startup_acceleration: number;
    comfort_acceleration: number;
    gamma_value: number;
    inertia_coefficient: number;
    loading_gauge: string;
    rolling_resistance_A: number;
    rolling_resistance_B: number;
    rolling_resistance_C: number;
  };
};

type RollingStockEditorElementsProps = {
  label: string;
  options?: string[];
  position: boolean;
  error: string;
  register: UseFormRegister<FieldValues>;
};

const sideValue = {
  left: true,
  right: false,
};

const RollingStockEditorInput = ({
  label,
  position,
  error,
  register,
}: RollingStockEditorElementsProps) => {
  const { t } = useTranslation('rollingStockEditor');
  return (
    <div
      className={`d-flex flex-row${
        position ? '' : '-reverse'
      } justify-content-between align-items-center mb-2`}
    >
      <label className={`text-primary col-8 ${position ? 'mr-2' : 'ml-2'} my-0`} htmlFor={label}>
        {error && (
          <div className="text-yellow">
            <BiErrorCircle />
          </div>
        )}
        {t(label)}
      </label>
      <input
        id={label}
        className={`form-control-sm bg-white px-2 ${!position ? 'col-3' : 'col-4'}`}
        {...register(label)}
      />
      {!position && (
        <span className="col-1">
          {label.substring(label.length - 1, label.length).toLocaleLowerCase()}:{' '}
        </span>
      )}
    </div>
  );
};

const RollingStockEditorSelect = ({
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
        <option>...</option>
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
  setIsEditing: React.Dispatch<React.SetStateAction<boolean>>;
};

const RollingStockEditorForm = ({
  rollingStockData,
  setIsEditing,
}: RollingStockParametersProps) => {
  const { t } = useTranslation('rollingStockEditor');
  const { openModal } = useModal();
  const jsonSchema = openapiSchemaToJsonSchema(RollingStockBaseOpenapiSchema);
  const schema = jsonSchema.components.schemas.RollingStockBase;

  const resolver = ajvResolver(schema, {
    formats: fullFormats,
    coerceTypes: true,
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RollingStockParametersValues>({
    resolver: resolver as Resolver<RollingStockParametersValues, unknown>,
    defaultValues: {
      startup_time: rollingStockData?.startup_time || 0,
      startup_acceleration: rollingStockData?.startup_acceleration || 0,
      comfort_acceleration: rollingStockData?.comfort_acceleration || 0,
      gamma_value: rollingStockData?.gamma.value || 0,
      inertia_coefficient: rollingStockData?.inertia_coefficient || 0,
      loading_gauge: (rollingStockData?.loading_gauge as string) || '...',
      rolling_resistance_A: rollingStockData?.rolling_resistance.A || 0,
      rolling_resistance_B: rollingStockData?.rolling_resistance.B || 0,
      rolling_resistance_C: rollingStockData?.rolling_resistance.C || 0,
    },
  } as UseFormProps<RollingStockParametersValues>);

  // in the left side of the form, we display all the information except the rollingStock resistance params,
  // which are displayed in the right part of the form
  const parameterForm = (position: boolean, registerForm: UseFormRegister<FieldValues>) =>
    Object.keys(schema.properties)
      .filter((property) =>
        position
          ? !property.includes('rolling_resistance')
          : property.includes('rolling_resistance')
      )
      .map((property) => (
        <div className="d-flex flex-column" key={property}>
          {schema.properties[property].enum ? (
            <RollingStockEditorSelect
              label={property}
              options={schema.properties[property]?.enum}
              register={registerForm}
              position={position}
              error={errors[property] as unknown as string}
            />
          ) : (
            <RollingStockEditorInput
              label={property}
              register={registerForm}
              position={position}
              error={errors[property] as unknown as string}
            />
          )}
        </div>
      ));

  const submit: SubmitHandler<FieldValues> = (data: FieldValues) => {
    console.warn(data);
    openModal(
      <RollingStockEditorFormModal
        setIsEditing={setIsEditing}
        mainText={t('confirmAction')}
        buttonText={t('confirm')}
      />
    );
  };

  const cancel = () => {
    openModal(
      <RollingStockEditorFormModal
        setIsEditing={setIsEditing}
        mainText={t('cancelAction')}
        buttonText={t('cancel')}
      />
    );
  };

  return (
    <form className="d-flex flex-column form-control bg-white" onSubmit={handleSubmit(submit)}>
      <div className="d-flex justify-content-center">
        <div className="col-6 mr-4">{parameterForm(sideValue.left, register)}</div>
        <div className="col-6">
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
