import React, { FC, PropsWithChildren, useContext, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ModalContext } from './ModalProvider';
import { Modal } from './Modal';

export interface ConfirmModalProps {
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: (setDisabled: (disabled: boolean) => void) => void | Promise<void>;
  onCancel?: () => void | Promise<void>;
}

export const ConfirmModal: FC<PropsWithChildren<ConfirmModalProps>> = ({
  title,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  children,
}) => {
  const { t } = useTranslation();
  const { closeModal } = useContext(ModalContext);
  const [disabled, setDisabled] = useState(false);

  return (
    <Modal title={title}>
      <>{children}</>

      <div className="text-right">
        <button
          type="button"
          className="btn btn-danger mr-2"
          onClick={() => (onCancel ? onCancel() : closeModal())}
          disabled={disabled}
        >
          {cancelLabel || t('common.cancel')}
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => onConfirm(setDisabled)}
          disabled={disabled}
        >
          {confirmLabel || t('common.confirm')}
        </button>
      </div>
    </Modal>
  );
};

export default ConfirmModal;
