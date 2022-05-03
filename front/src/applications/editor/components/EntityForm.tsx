import { FC } from 'react';
import Form from '@rjsf/core';

import { EntityBase, EntityModel } from '../data/entity';

interface EntityFormProps {
  entity: EntityModel;
  onSubmit: (data: EntityModel) => void;
}

/**
 * Display a form to create a new entity.
 */
const EntityForm: FC<EntityFormProps> = ({ entity, onSubmit }) => {
  console.log(entity, entity.getJsonSchema(), entity.toObject());
  return (
    <Form
      formData={entity.toObject()}
      schema={entity.getJsonSchema()}
      onSubmit={(e) => {
        entity.update(e.formData as unknown as EntityBase);
        onSubmit(entity);
      }}
    />
  );
};

export default EntityForm;
