import React from 'react';
import { BiDuplicate, BiTrash } from 'react-icons/bi';
import { FaPencilAlt } from 'react-icons/fa';
import { RollingStock, osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { setSuccess, setFailure } from 'reducers/main';
import { useModal } from 'common/BootstrapSNCF/ModalSNCF';
import RollingStockEditorFormModal from './RollingStockEditorFormModal';

type RollingStockEditorButtonsProps = {
  rollingStock: RollingStock;
  setIsEditing: (isEditing: boolean) => void;
  setOpenedRollingStockCardId: React.Dispatch<React.SetStateAction<number | undefined>>;
  isRollingStockLocked: boolean;
  isCondensed: boolean;
};

function RollingStockEditorButtons({
  rollingStock,
  setIsEditing,
  setOpenedRollingStockCardId,
  isRollingStockLocked,
  isCondensed,
}: RollingStockEditorButtonsProps) {
  const dispatch = useDispatch();
  const { t } = useTranslation(['rollingstock', 'translation']);
  const { openModal } = useModal();
  const [deleteRollingStockById] = osrdEditoastApi.useDeleteRollingStockByIdMutation();
  const [postRollingstock] = osrdEditoastApi.usePostRollingStockMutation();

  const deleteRollingStock = () => {
    setOpenedRollingStockCardId(undefined);
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
        .catch((error) => {
          if (error.status === 409) {
            openModal(
              <RollingStockEditorFormModal
                mainText={t('messages.rollingStockNotDeleted')}
                errorObject={error.data.context.usage}
              />
            );
          }
          dispatch(
            setFailure({
              name: t('messages.failure'),
              message: t('messages.rollingStockNotDeleted'),
            })
          );
        });
  };

  const duplicateRollingStock = () => {
    const duplicatedRollingstock = { ...rollingStock, name: `${rollingStock.name} - ${t('copy')}` };
    postRollingstock({
      locked: false,
      rollingStockUpsertPayload: duplicatedRollingstock,
    })
      .unwrap()
      .then((res) => {
        setOpenedRollingStockCardId(res.id);
        setIsEditing(true);
        dispatch(
          setSuccess({
            title: t('messages.success'),
            text: t('messages.rollingStockAdded'),
          })
        );
      })
      .catch((error) => {
        if (error.data?.message.includes('duplicate')) {
          dispatch(
            setFailure({
              name: t('messages.failure'),
              message: t('messages.rollingStockDuplicateName'),
            })
          );
        } else {
          dispatch(
            setFailure({
              name: t('messages.failure'),
              message: t('messages.rollingStockNotAdded'),
            })
          );
        }
      });
  };

  const confirmDelete = () => {
    openModal(
      <RollingStockEditorFormModal
        request={deleteRollingStock}
        mainText={t('confirmAction')}
        buttonText={t('translation:common.confirm')}
      />
    );
  };

  const confirmDuplicate = () => {
    openModal(
      <RollingStockEditorFormModal
        request={duplicateRollingStock}
        mainText={t('confirmAction')}
        buttonText={t('translation:common.confirm')}
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
        className="btn btn-primary bg-orange px-1 py-0"
        tabIndex={0}
        disabled={isRollingStockLocked}
        onClick={() => setIsEditing(true)}
      >
        <FaPencilAlt />
      </button>
      <button
        type="button"
        className="btn btn-primary px-1 py-0"
        tabIndex={0}
        onClick={() => confirmDuplicate()}
      >
        <BiDuplicate />
      </button>
      <button
        type="button"
        className="btn btn-primary bg-red px-1 py-0"
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
