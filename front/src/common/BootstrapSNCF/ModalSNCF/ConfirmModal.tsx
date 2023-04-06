import React, { FC, PropsWithChildren, useContext, useCallback } from 'react';
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
  const { closeModal, isDisabled, disableModal } = useContext(ModalContext);

  const confirm = useCallback(async () => {
    disableModal(true);
    try {
      await onConfirm();
    } catch (e) {
      console.error(e);
    } finally {
      disableModal(false);
    }
  }, [onConfirm, disableModal]);

  const cancel = useCallback(async () => {
    if (onCancel) {
      disableModal(true);
      try {
        await onCancel();
      } catch (e) {
        console.error(e);
      } finally {
        disableModal(false);
      }
    } else {
      closeModal();
    }
  }, [onCancel, closeModal, disableModal]);

  return (
    <Modal title={title} withCloseButton>
      <>{children}</>

      <div className="text-right">
        <button
          type="button"
          className="btn btn-danger mr-2"
          onClick={() => cancel()}
          disabled={isDisabled}
        >
          {cancelLabel || t('common.cancel')}
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => confirm()}
          disabled={isDisabled}
        >
          {confirmLabel || t('common.confirm')}
        </button>
      </div>
    </Modal>
  );
};

export default ConfirmModal;
