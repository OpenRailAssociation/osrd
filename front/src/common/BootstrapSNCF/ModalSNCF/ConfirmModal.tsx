import React, { FC, PropsWithChildren, useContext } from 'react';
import { useTranslation } from 'react-i18next';

import { ModalContext } from './ModalProvider';
import { Modal } from './Modal';

export interface ConfirmModalProps {
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void | Promise<void>;
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

  return (
    <Modal title={title}>
      <>{children}</>

      <div className="text-right">
        <button
          type="button"
          className="btn btn-danger mr-2"
          onClick={() => (onCancel ? onCancel() : closeModal())}
        >
          {cancelLabel || t('common.cancel')}
        </button>
        <button type="button" className="btn btn-primary" onClick={() => onConfirm()}>
          {confirmLabel || t('common.confirm')}
        </button>
      </div>
    </Modal>
  );
};

export default ConfirmModal;
