import React, { useState } from 'react';
import Form from '@rjsf/core';
import { useSelector } from 'react-redux';

import { EditorEntity } from '../../../types';
import { EditorState } from '../../../reducers/editor';
import { getJsonSchemaForLayer, getLayerForObjectType } from '../data/utils';

interface EditorFormProps {
  data: EditorEntity;
  onSubmit: (data: EditorEntity) => void;
}

/**
 * Display a form to create/update a new entity.
 */
const EditorForm: React.FC<EditorFormProps> = ({ data, onSubmit }) => {
  const [error, setError] = useState<unknown | null>(null);
  const editorState = useSelector((state: { editor: EditorState }) => state.editor);
  const layer = getLayerForObjectType(editorState.editorSchema, data.objType);
  const schema = getJsonSchemaForLayer(editorState.editorSchema, layer || '');
  if (!schema) throw new Error(`Missing data type for ${layer}`);

  return (
    <div>
      {error !== null && <p className="error">{JSON.stringify(error)}</p>}
      <Form
        formData={data.properties}
        schema={schema || {}}
        onSubmit={(event) => {
          try {
            onSubmit({ ...data, properties: { ...data.properties, ...event.formData } });
          } catch (e) {
            setError(e);
          }
        }}
      />
    </div>
  );
};

export default EditorForm;
