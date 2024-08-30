import React, { type PropsWithChildren, useContext, useState, useCallback } from 'react';

import { useTranslation } from 'react-i18next';

import { Modal } from './Modal';
import { ModalContext } from './ModalProvider';

export interface ConfirmModalProps {
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmDisabled?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void | Promise<void>;
  withCloseButton?: boolean;
}

export const ConfirmModal = ({
  title,
  confirmLabel,
  cancelLabel,
  confirmDisabled = false,
  onConfirm,
  onCancel,
  withCloseButton = true,
  children,
}: PropsWithChildren<ConfirmModalProps>) => {
  const { t } = useTranslation();
  const { closeModal } = useContext(ModalContext);
  const [disabled, setDisabled] = useState(false);

  const confirm = useCallback(async () => {
    setDisabled(true);
    try {
      await onConfirm();
    } catch (e) {
      console.error(e);
    } finally {
      setDisabled(false);
    }
  }, [onConfirm]);

  const cancel = useCallback(async () => {
    if (onCancel) {
      setDisabled(true);
      try {
        await onCancel();
      } catch (e) {
        console.error(e);
      } finally {
        setDisabled(false);
      }
    } else {
      closeModal();
    }
  }, [onCancel, closeModal]);

  return (
    <Modal title={title} withCloseButton={withCloseButton}>
      {children}

      <div className="d-flex ml-auto mt-3">
        <button
          type="button"
          className="btn btn-secondary flex-grow-1"
          onClick={() => cancel()}
          disabled={disabled}
        >
          {cancelLabel || t('common.cancel')}
        </button>
        <button
          type="button"
          className="btn btn-primary flex-grow-1 ml-2"
          onClick={() => confirm()}
          disabled={confirmDisabled || disabled}
        >
          {confirmLabel || t('common.confirm')}
        </button>
      </div>
    </Modal>
  );
};

export default ConfirmModal;
