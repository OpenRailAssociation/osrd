import cx from 'classnames';
import React from 'react';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { useAppDispatch } from 'store';
import { setSuccess, setFailure } from 'reducers/main';
import { useModal } from 'common/BootstrapSNCF/ModalSNCF';
import { useTranslation } from 'react-i18next';

import { Duplicate, Pencil, Trash } from '@osrd-project/ui-icons';
import RollingStockEditorFormModal from 'modules/rollingStock/components/RollingStockEditor/RollingStockEditorFormModal';

import type { RollingStock } from 'common/api/osrdEditoastApi';

type RollingStockEditorButtonsProps = {
  rollingStock: RollingStock;
  setIsEditing: (isEditing: boolean) => void;
  setIsDuplicating: (isDuplicating: boolean) => void;
  setOpenedRollingStockCardId: React.Dispatch<React.SetStateAction<number | undefined>>;
  isRollingStockLocked: boolean;
  isCondensed: boolean;
};

const RollingStockEditorButtons = ({
  rollingStock,
  setIsEditing,
  setIsDuplicating,
  setOpenedRollingStockCardId,
  isRollingStockLocked,
  isCondensed,
}: RollingStockEditorButtonsProps) => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation(['rollingstock', 'translation']);
  const { openModal } = useModal();
  const [deleteRollingStockById] = osrdEditoastApi.useDeleteRollingStockByRollingStockIdMutation();
  const [postRollingstock] = osrdEditoastApi.usePostRollingStockMutation();

  const deleteRollingStock = () => {
    setOpenedRollingStockCardId(undefined);
    if (!rollingStock.locked)
      deleteRollingStockById({ rollingStockId: rollingStock.id })
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
    const date = new Date().getTime().toString().slice(-3);
    const duplicatedRollingstock = { ...rollingStock, name: `${rollingStock.name}-${date}` };
    postRollingstock({
      locked: false,
      rollingStockForm: duplicatedRollingstock,
    })
      .unwrap()
      .then((res) => {
        setOpenedRollingStockCardId(res.id);
        setIsEditing(true);
        setIsDuplicating(true);
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
        mainText={t('deleteRollingStock')}
        buttonText={t('translation:common.yes')}
        deleteAction
      />
    );
  };

  return (
    <div
      className={cx('rollingstock-editor-buttons d-flex p-1', {
        'condensed flex-column align-items-center rounded-right': isCondensed,
      })}
    >
      <button
        type="button"
        className="btn btn-primary bg-orange px-1 py-0"
        aria-label={t('translation:common.edit')}
        title={t('translation:common.edit')}
        tabIndex={0}
        disabled={isRollingStockLocked}
        onClick={() => setIsEditing(true)}
      >
        <Pencil />
      </button>
      <button
        type="button"
        className="btn btn-primary px-1 py-0"
        aria-label={t('translation:common.duplicate')}
        title={t('translation:common.duplicate')}
        tabIndex={0}
        onClick={() => duplicateRollingStock()}
      >
        <Duplicate />
      </button>
      <button
        type="button"
        className="btn btn-primary bg-red px-1 py-0"
        aria-label={t('translation:common.delete')}
        title={t('translation:common.delete')}
        tabIndex={0}
        disabled={isRollingStockLocked}
        onClick={() => confirmDelete()}
      >
        <Trash />
      </button>
    </div>
  );
};

export default RollingStockEditorButtons;
