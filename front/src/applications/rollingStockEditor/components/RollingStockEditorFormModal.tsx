import React from 'react';
import { useModal } from 'common/BootstrapSNCF/ModalSNCF';
import { useTranslation } from 'react-i18next';

type RollingStockEditorFormModalProps = {
  setIsEditing: (isEditing: boolean) => void;
  mainText: string;
  buttonText: string;
};

const RollingStockEditorFormModal = ({
  setIsEditing,
  mainText,
  buttonText,
}: RollingStockEditorFormModalProps) => {
  const { closeModal } = useModal();
  const { t } = useTranslation('rollingStockEditor');

  return (
    <div className="d-flex flex-column align-items-center p-3 w-100">
      <span className="text-primary mb-3">{mainText}</span>
      <div className="d-flex justify-content-around w-100">
        <button type="button" className="btn btn-sm btn-primary-gray" onClick={() => closeModal()}>
          {t('back')}
        </button>
        <button
          type="button"
          className="btn btn-sm btn-primary ml-3"
          onClick={() => {
            setIsEditing(false);
            closeModal();
          }}
        >
          {buttonText}
        </button>
      </div>
    </div>
  );
};

export default RollingStockEditorFormModal;
