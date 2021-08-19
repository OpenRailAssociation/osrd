import React, { useState } from 'react';
import Form from '@rjsf/core';
import { useSelector } from 'react-redux';
import { JSONSchema7 } from 'json-schema';
import { Entity } from '../../../types';
import { EditorState } from '../../../reducers/editor';

interface EntityFormProps {
  entity: Entity;
  onSubmit: (data: Entity) => void;
}

/**
 * Display a form to create a new entity.
 *
 */
export const EntityForm: FC<EntityFormProps> = ({ entity, onSubmit }) => {
  const [entityObject, setEntityObject] = useState<unknown>(entity.toObject());

  // Model definitions taken from the state
  const entitiesDefinintion = useSelector(
    (state: { editor: EditorState }) => state.editor.editorEntitiesDefinintion,
  );
  const editorComponentsDefinition = useSelector(
    (state: { editor: EditorState }) => state.editor.editorComponentsDefinition,
  );

  // Compute the JSON schema
  const jsonSchema: JSONSchema7 = {
    type: 'object',
    properties: {},
    required: [],
  };
  entitiesDefinintion[entity.entity_type]
    .filter((name) => !['geo_line_location', 'identifier'].includes(name))
    .forEach((componentType: string) => {
      jsonSchema.properties[componentType] = editorComponentsDefinition[componentType];
      jsonSchema.required.push(componentType);
    });

  return (
    <Form
      formData={entityObject}
      onChange={(e) => setEntityObject(e.formData)}
      schema={jsonSchema}
      onSubmit={(e) => {
        console.log(e);
        onSubmit(new Entity(e.formData));
      }}
    />
  );
};
