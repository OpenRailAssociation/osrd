import React, { FC } from 'react';

import Modal from './Modal';
import EditorForm from './EditorForm';
import { EditorEntity } from '../../../types';
import { ModalProps } from '../tools/types';

const EditorModal: FC<
  ModalProps<{ entity: EditorEntity; title?: string }, { savedEntity: EditorEntity }>
> = ({ arguments: { entity, title }, cancel, submit }) => {
  return (
    <Modal onClose={cancel} title={title}>
      <EditorForm
        data={entity}
        onSubmit={async (savedEntity) => {
          submit({ savedEntity });
        }}
      />
    </Modal>
  );
};

export default EditorModal;
