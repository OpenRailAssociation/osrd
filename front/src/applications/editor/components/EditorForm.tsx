import React from 'react';
import Form from '@rjsf/core';
import { Feature } from 'geojson';
import { useSelector } from 'react-redux';
import { EditorState } from '../../../reducers/editor';

interface EditorFormProps {
  layer: string;
  data: Feature;
  onSubmit: (data: Feature) => void;
}

/**
 * Display a form to create a new entity.
 */
const EditorForm: React.FC<EditorFormProps> = ({ layer, data, onSubmit }) => {
  const editorState = useSelector((state: { editor: EditorState }) => state.editor);
  const schema = editorState.editorSchema[layer];
  return (
    <Form
      formData={data.properties}
      schema={schema}
      onSubmit={(e) => onSubmit({ ...data, properties: e.formData })}
    />
  );
};

export default EditorForm;
