import React, { useState, useEffect } from 'react';
import Form from '@rjsf/core';
import { useSelector } from 'react-redux';
import { GeoJsonProperties } from 'geojson';

import './EditorForm.scss';
import { EditorEntity } from '../../../types';
import { EditorState } from '../../../reducers/editor';
import { getJsonSchemaForLayer, getLayerForObjectType } from '../data/utils';

interface EditorFormProps {
  data: EditorEntity;
  onSubmit: (data: EditorEntity) => Promise<void>;
  onChange?: (data: EditorEntity) => void;
}

/**
 * Display a form to create/update a new entity.
 */
const EditorForm: React.FC<EditorFormProps> = ({ data, onSubmit, onChange, children }) => {
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<GeoJsonProperties>(data.properties);

  const editorState = useSelector((state: { editor: EditorState }) => state.editor);
  const layer = getLayerForObjectType(editorState.editorSchema, data.objType);
  const schema = getJsonSchemaForLayer(editorState.editorSchema, layer || '');
  if (!schema) throw new Error(`Missing data type for ${layer}`);

  useEffect(() => {
    setFormData(data.properties);
  }, [data]);

  /**
   * When errors are displayed, we scroll to them.
   */
  useEffect(() => {
    const modal = document.getElementsByClassName('modal-body')[0];
    if (error && modal) {
      modal.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
    }
  }, [error]);

  return (
    <div>
      {error !== null && (
        <div className="form-error mt-3 mb-3">
          <p>{error}</p>
        </div>
      )}
      <Form
        formData={formData}
        schema={schema || {}}
        onSubmit={async (event) => {
          try {
            setError(null);
            setFormData(event.formData);
            await onSubmit({ ...data, properties: { ...data.properties, ...event.formData } });
          } catch (e) {
            if (e instanceof Error) setError(e.message);
            else setError(JSON.stringify(e));
          }
        }}
        onChange={(event) => {
          if (onChange)
            onChange({ ...data, properties: { ...data.properties, ...event.formData } });
        }}
      >
        {children}
      </Form>
    </div>
  );
};

export default EditorForm;
