import React, { useState } from 'react';
import Form from '@rjsf/core';
import { useSelector } from 'react-redux';
import { JSONSchema7 } from 'json-schema';
import { EntityModel } from '../data/entity';
import { EditorState } from '../../../reducers/editor';

interface EntityFormProps {
  entity: EntityModel;
  onSubmit: (data: Entity) => void;
}

/**
 * Display a form to create a new entity.
 *
 */
export const EntityForm: FC<EntityFormProps> = ({ entity, onSubmit }) => {
  console.log(entity, entity.getJsonSchema(), entity.toObject());
  return (
    <Form
      formData={entity.toObject()}
      schema={entity.getJsonSchema()}
      onSubmit={(e) => {
        entity.update(e.formData);
        onSubmit(entity);
      }}
    />
  );
};
