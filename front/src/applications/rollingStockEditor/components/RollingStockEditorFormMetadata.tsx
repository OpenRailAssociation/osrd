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
import RollingStockMetadataOpenApiSchema from '../json/RollingStockMetadataOpenApiSchema.json';

type RollingStockMetadataValues = {
  [key: string]: {
    detail: string;
    family: string;
    grouping: string;
    number: string;
    reference: string;
    series: string;
    subseries: string;
    type: string;
    unit: string;
  };
};

type RollingStockEditorFormMetadataProps = {
  setIsAdding?: React.Dispatch<React.SetStateAction<boolean>>;
  isAdding?: boolean;
};

const RollingStockEditorFormMetadata = ({
  setIsAdding,
  isAdding,
}: RollingStockEditorFormMetadataProps) => {
  const { t } = useTranslation('rollingStockEditor');
  const jsonSchema = openapiSchemaToJsonSchema(RollingStockMetadataOpenApiSchema);
  const schema = jsonSchema.components.schemas.Metadata;

  const resolver = ajvResolver(schema, {
    formats: fullFormats,
    coerceTypes: true,
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RollingStockMetadataValues>({
    resolver: resolver as Resolver<RollingStockMetadataValues, unknown>,
    defaultValues: {
      detail: '',
      family: '',
      grouping: '',
      number: '',
      reference: '',
      series: '',
      subseries: '',
      type: '',
      unit: '',
    },
  } as UseFormProps<RollingStockMetadataValues>);

  return <div>RollingStockEditorFormMetadata</div>;
};

export default RollingStockEditorFormMetadata;
