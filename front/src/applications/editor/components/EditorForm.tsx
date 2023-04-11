import React, { useState, useEffect, useMemo, PropsWithChildren } from 'react';
import Form from '@rjsf/core';
import { UiSchema, Field } from '@rjsf/utils';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { GeoJsonProperties } from 'geojson';
import { JSONSchema7 } from 'json-schema';
import { isNil, omitBy } from 'lodash';
import { customizeValidator, Localizer } from '@rjsf/validator-ajv8';
import localizer from 'ajv-i18n';

import './EditorForm.scss';
import { EditorEntity } from '../../../types';
import { FormComponent, FormLineStringLength } from './LinearMetadata';
import {
  getJsonSchemaForLayer,
  getLayerForObjectType,
  NEW_ENTITY_ID,
  localizedJsonSchema,
} from '../data/utils';
import { EditorState } from '../tools/types';

const fields = {
  ArrayField: FormComponent,
};

interface EditorFormProps<T> {
  data: T;
  onSubmit: (data: T) => Promise<void>;
  onChange?: (data: T) => void;

  // Overrides:
  overrideSchema?: JSONSchema7;
  overrideUiSchema?: UiSchema;
  overrideFields?: Record<string, Field>;
}

/**
 * Display a form to create/update a new entity.
 */
function EditorForm<T extends Omit<EditorEntity, 'objType'> & { objType: string }>({
  data,
  onSubmit,
  onChange,
  overrideSchema,
  overrideUiSchema,
  overrideFields,
  children,
}: PropsWithChildren<EditorFormProps<T>>) {
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<GeoJsonProperties>(data.properties);
  const [submited, setSubmited] = useState<boolean>(false);
  const { t, i18n } = useTranslation('editor');
  const validator = customizeValidator(
    {},
    localizer[i18n.language as keyof typeof localizer] as Localizer
  );
  const editorState = useSelector((state: { editor: EditorState }) => state.editor);
  const layer = useMemo(
    () => getLayerForObjectType(editorState.editorSchema, data.objType),
    [data.objType, editorState.editorSchema]
  );
  const schema = useMemo(
    () =>
      localizedJsonSchema(
        (overrideSchema ||
          getJsonSchemaForLayer(editorState.editorSchema, layer || '')) as JSONSchema7,
        t,
        'Editor.form'
      ),
    [editorState.editorSchema, layer, overrideSchema]
  );
  if (!schema) throw new Error(`Missing data type for ${layer}`);

  /**
   * When data or schema change
   * => recompute formData by fixing LM
   */
  useEffect(() => {
    setFormData(omitBy(data.properties, isNil));
  }, [data, schema]);

  /**
   * When errors are displayed, we scroll to them.
   */
  useEffect(() => {
    const container = document.getElementsByClassName('panel-box')[0];
    if (error && container) {
      container.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
    }
  }, [error]);

  return (
    <div>
      {submited && error !== null && (
        <div className="form-error mt-3 mb-3">
          <p>{error}</p>
        </div>
      )}
      <Form
        fields={{ ...fields, ...(overrideFields || {}) }}
        liveValidate={submited}
        action={undefined}
        noHtml5Validate
        method={undefined}
        validator={validator}
        translateString={(key, _params) => t(`Editor.form.common.${key}`)}
        schema={schema}
        uiSchema={{
          length: {
            'ui:widget': FormLineStringLength,
          },
          ...(overrideUiSchema || {}),
        }}
        formData={formData}
        formContext={{
          geometry: data.geometry,
          length: data.properties?.length,
          isCreation: isNil(formData?.id) || formData?.id === NEW_ENTITY_ID,
        }}
        onError={() => setSubmited(true)}
        onSubmit={async () => {
          try {
            setError(null);
            await onSubmit({ ...data, properties: { ...data.properties, ...formData } });
          } catch (e) {
            if (e instanceof Error) setError(e.message);
            else setError(JSON.stringify(e));
          } finally {
            setSubmited(true);
          }
        }}
        onChange={(event) => {
          setFormData({ ...data.properties, ...event.formData });
          if (onChange) {
            onChange({ ...data, properties: { ...data.properties, ...event.formData } });
          }
        }}
      >
        {children}
      </Form>
    </div>
  );
}

export default EditorForm;
