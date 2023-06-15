import React from 'react';
import { BiDuplicate, BiTrash } from 'react-icons/bi';
import { FaPencilAlt } from 'react-icons/fa';
import { LightRollingStock, osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { setSuccess, setFailure } from 'reducers/main';
import { useModal } from 'common/BootstrapSNCF/ModalSNCF';
import RollingStockEditorFormModal from './RollingStockEditorFormModal';

type RollingStockEditorButtonsProps = {
  rollingStock: LightRollingStock;
  setIsEditing: (isEditing: boolean) => void;
  isRollingStockLocked: boolean;
  isCondensed: boolean;
};

function RollingStockEditorButtons({
  rollingStock,
  setIsEditing,
  isRollingStockLocked,
  isCondensed,
}: RollingStockEditorButtonsProps) {
  const dispatch = useDispatch();
  const { t } = useTranslation('rollingStockEditor');
  const { openModal } = useModal();
  const [deleteRollingStockById] = osrdEditoastApi.useDeleteRollingStockByIdMutation();

  const deleteRollingStock = () => {
    if (!rollingStock.locked)
      deleteRollingStockById({ id: rollingStock.id })
        .unwrap()
        .then(() => {
          dispatch(
            setSuccess({
              title: t('messages.success'),
              text: t('messages.rollingStockDeleted'),
            })
          );
        })
        .catch(() => {
          dispatch(
            setFailure({
              name: t('messages.failure'),
              message: t('messages.rollingStockNotDeleted'),
            })
          );
        });
  };

  const confirmDelete = () => {
    openModal(
      <RollingStockEditorFormModal
        request={deleteRollingStock}
        mainText={t('confirmAction')}
        buttonText={t('confirm')}
      />
    );
  };

  return (
    <div
      className={`rollingstock-editor-buttons ${
        isCondensed ? 'condensed flex-column align-items-center rounded-right' : ''
      } d-flex p-1`}
    >
      <button
        type="button"
        className="btn btn-primary px-1 py-0"
        tabIndex={0}
        disabled={isRollingStockLocked}
        onClick={() => setIsEditing(true)}
      >
        <FaPencilAlt />
      </button>
      <button type="button" className="btn btn-primary px-1 py-0" tabIndex={0}>
        <BiDuplicate />
      </button>
      <button
        type="button"
        className="btn btn-primary px-1 py-0"
        tabIndex={0}
        disabled={isRollingStockLocked}
        onClick={() => confirmDelete()}
      >
        <BiTrash />
      </button>
    </div>
  );
}

export default RollingStockEditorButtons;
