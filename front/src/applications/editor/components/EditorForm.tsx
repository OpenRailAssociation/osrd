import Form from '@rjsf/core';
import { Field, UiSchema } from '@rjsf/utils';
import { GeoJsonProperties } from 'geojson';
import i18n from 'i18n';
import { JSONSchema7 } from 'json-schema';
import { isNil, omitBy } from 'lodash';
import React, { useState, useEffect, useMemo, PropsWithChildren } from 'react';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import validator from '@rjsf/validator-ajv8';

import {
  getLayerForObjectType,
  getJsonSchemaForLayer,
  NEW_ENTITY_ID,
} from 'applications/editor/data/utils';
import { translateSchema } from 'applications/editor/tools/translationTools';
import { getEditorState } from 'reducers/editor/selectors';
import type { EditorEntity } from 'applications/editor/typesEditorEntity';

import { FormComponent, FormLineStringLength } from './LinearMetadata';

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
  const { t } = useTranslation('infraEditor');

  const editorState = useSelector(getEditorState);
  const layer = useMemo(
    () => getLayerForObjectType(editorState.editorSchema, data.objType),
    [data.objType, editorState.editorSchema]
  );
  const schema = useMemo(
    () => overrideSchema || getJsonSchemaForLayer(editorState.editorSchema, layer || ''),
    [editorState.editorSchema, layer, overrideSchema]
  );
  if (!schema) throw new Error(`Missing data type for ${layer}`);

  const isFrench = i18n.language === 'fr';
  const isI18nLoaded = i18n.hasLoadedNamespace('infraEditor');

  const translatedSchema = useMemo(() => translateSchema(schema, t), [schema, isI18nLoaded]);

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
        validator={validator}
        method={undefined}
        schema={isFrench ? translatedSchema : schema}
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
          onChange?.({ ...data, properties: { ...data.properties, ...event.formData } });
        }}
      >
        {children}
      </Form>
    </div>
  );
}

export default EditorForm;
