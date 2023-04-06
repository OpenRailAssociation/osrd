import React, { FC, PropsWithChildren, useContext, useState, useCallback } from 'react';
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
    <Modal title={title} withCloseButton>
      <>{children}</>

      <div className="text-right">
        <button
          type="button"
          className="btn btn-danger mr-2"
          onClick={() => cancel()}
          disabled={disabled}
        >
          {cancelLabel || t('common.cancel')}
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => confirm()}
          disabled={disabled}
        >
          {confirmLabel || t('common.confirm')}
        </button>
      </div>
    </Modal>
  );
};

export default ConfirmModal;
