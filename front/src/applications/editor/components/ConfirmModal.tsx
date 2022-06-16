import React, { FC, useContext } from 'react';

import { EditorContext, ModalProps } from '../context';
import Modal from './Modal';

const ConfirmModal: FC<
  ModalProps<{ message: string; title?: string; confirmLabel?: string; cancelLabel?: string }>
> = ({ arguments: { message, title, confirmLabel, cancelLabel }, cancel, submit }) => {
  const { t } = useContext(EditorContext);

  return (
    <Modal onClose={cancel} title={title}>
      <p>{message}</p>

      <div className="text-right">
        <button type="button" className="btn btn-danger mr-2" onClick={cancel}>
          {cancelLabel || t('common.cancel')}
        </button>
        <button type="button" className="btn btn-primary" onClick={submit}>
          {confirmLabel || t('common.confirm')}
        </button>
      </div>
    </Modal>
  );
};

export default ConfirmModal;
