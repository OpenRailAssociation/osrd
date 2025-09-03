import { Duplicate, Pencil, Trash } from '@osrd-project/ui-icons';
import cx from 'classnames';
import { useTranslation } from 'react-i18next';

import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import type { RollingStock } from 'common/api/osrdEditoastApi';
import { useModal } from 'common/BootstrapSNCF/ModalSNCF';
import { setSuccess, setFailure } from 'reducers/main';
import { useAppDispatch } from 'store';
import { castErrorToFailure, getErrorStatus } from 'utils/error';

import RollingStockEditorFormModal from './RollingStockEditorFormModal';

type RollingStockEditorButtonsProps = {
  rollingStock: RollingStock;
  setIsEditing: (isEditing: boolean) => void;
  resetFilters: () => void;
  setOpenedRollingStockCardId: React.Dispatch<React.SetStateAction<number | undefined>>;
  isRollingStockLocked: boolean;
  isCondensed: boolean;
};

const RollingStockEditorButtons = ({
  rollingStock,
  setIsEditing,
  resetFilters,
  setOpenedRollingStockCardId,
  isRollingStockLocked,
  isCondensed,
}: RollingStockEditorButtonsProps) => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation();
  const { openModal } = useModal();
  const [deleteRollingStockById] =
    osrdEditoastApi.endpoints.deleteRollingStockByRollingStockId.useMutation();
  const [postRollingstock] = osrdEditoastApi.endpoints.postRollingStock.useMutation();

  const deleteRollingStock = () => {
    setOpenedRollingStockCardId(undefined);
    if (!rollingStock.locked)
      deleteRollingStockById({ rollingStockId: rollingStock.id })
        .unwrap()
        .then(() => {
          dispatch(
            setSuccess({
              title: t('rollingStock.messages.success'),
              text: t('rollingStock.messages.rollingStockDeleted'),
            })
          );
        })
        .catch((error) => {
          if (getErrorStatus(error) === 409) {
            openModal(
              <RollingStockEditorFormModal
                mainText={t('rollingStock.messages.rollingStockNotDeleted')}
                errorObject={error.data.context.usage}
              />
            );
          }
          dispatch(
            setFailure(
              castErrorToFailure(error, {
                name: t('rollingStock.messages.failure'),
                message: t('rollingStock.messages.rollingStockNotDeleted'),
              })
            )
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
        resetFilters();
        dispatch(
          setSuccess({
            title: t('rollingStock.messages.success'),
            text: t('rollingStock.messages.rollingStockAdded'),
          })
        );
      })
      .catch((error) => {
        dispatch(
          setFailure(castErrorToFailure(error, { name: t('rollingStock.messages.failure') }))
        );
      });
  };

  const confirmDelete = () => {
    openModal(
      <RollingStockEditorFormModal
        request={deleteRollingStock}
        mainText={t('rollingStock.deleteRollingStock')}
        buttonText={t('common.yes')}
        deleteAction
      />
    );
  };

  return (
    <div
      className={cx('rollingstock-editor-buttons', {
        'condensed flex-column align-items-center': isCondensed,
      })}
    >
      <button
        data-testid="rollingstock-edit-button"
        type="button"
        className="btn btn-primary bg-orange px-1 py-0"
        aria-label={t('common.edit')}
        title={t('common.edit')}
        tabIndex={0}
        disabled={isRollingStockLocked}
        onClick={() => setIsEditing(true)}
      >
        <Pencil />
      </button>
      <button
        data-testid="rollingstock-duplicate-button"
        type="button"
        className="btn btn-primary px-1 py-0"
        aria-label={t('common.duplicate')}
        title={t('common.duplicate')}
        tabIndex={0}
        onClick={() => duplicateRollingStock()}
      >
        <Duplicate />
      </button>
      <button
        data-testid="rollingstock-delete-button"
        type="button"
        className="btn btn-primary bg-red px-1 py-0"
        aria-label={t('common.delete')}
        title={t('common.delete')}
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
