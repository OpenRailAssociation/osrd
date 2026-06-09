import { useCallback } from 'react';

import { Duplicate, Pencil, Trash } from '@osrd-project/ui-icons';
import cx from 'classnames';
import { useTranslation } from 'react-i18next';

import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import type { RollingStock } from 'common/api/osrdEditoastApi';
import { useCheckProtectedAction } from 'common/authorization/hooks/useProtectedAction';
import type { Privilege } from 'common/authorization/types';
import { useModal } from 'common/BootstrapSNCF/ModalSNCF';
import { setSuccess, setFailure } from 'reducers/main';
import { useAppDispatch } from 'store';
import { castErrorToFailure, getErrorStatus } from 'utils/error';

import type { PageMode } from '../RollingStockEditorView';
import RollingStockEditorFormModal from './RollingStockEditorFormModal';

type RollingStockEditorButtonsProps = {
  rollingStock: RollingStock;
  resetFilters: () => void;
  setPageMode: React.Dispatch<React.SetStateAction<PageMode>>;
  isCondensed: boolean;
  userPrivileges: Set<Privilege>;
};

const RollingStockEditorButtons = ({
  rollingStock,
  resetFilters,
  setPageMode,
  isCondensed,
  userPrivileges,
}: RollingStockEditorButtonsProps) => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation();
  const { openModal } = useModal();
  const checkProtectedAction = useCheckProtectedAction();
  const [deleteRollingStockById] =
    osrdEditoastApi.endpoints.deleteRollingStockByRollingStockId.useMutation();
  const [postRollingstock] = osrdEditoastApi.endpoints.postRollingStock.useMutation();

  const editRollingStock = useCallback(() => {
    setPageMode({ type: 'edit', rollingStockId: rollingStock.id });
  }, [setPageMode, rollingStock.id]);

  const duplicateRollingStock = useCallback(
    () =>
      checkProtectedAction(userPrivileges, ['can_read'], () => {
        const date = new Date().getTime().toString().slice(-3);
        const duplicatedRollingstock = { ...rollingStock, name: `${rollingStock.name}-${date}` };
        postRollingstock({
          locked: false,
          rollingStockForm: duplicatedRollingstock,
        })
          .unwrap()
          .then((res) => {
            setPageMode({ type: 'edit', rollingStockId: res.id });
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
      }),
    [userPrivileges, rollingStock]
  );

  const deleteRollingStock = useCallback(
    () =>
      checkProtectedAction(userPrivileges, ['can_delete'], () => {
        setPageMode({ type: 'idle' });
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
      }),
    [setPageMode, rollingStock.id, rollingStock.locked, userPrivileges]
  );

  const confirmDelete = () => {
    openModal(
      <RollingStockEditorFormModal
        onSubmit={deleteRollingStock}
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
        title={
          userPrivileges.has('can_write') ? t('common.edit') : t('authorization.permissionDenied')
        }
        tabIndex={0}
        disabled={rollingStock.locked || !userPrivileges.has('can_write')}
        onClick={editRollingStock}
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
        onClick={duplicateRollingStock}
      >
        <Duplicate />
      </button>

      <button
        data-testid="rollingstock-delete-button"
        type="button"
        className="btn btn-primary bg-red px-1 py-0"
        aria-label={t('common.delete')}
        title={
          userPrivileges.has('can_delete')
            ? t('common.delete')
            : t('authorization.permissionDenied')
        }
        tabIndex={0}
        disabled={rollingStock.locked || !userPrivileges.has('can_delete')}
        onClick={confirmDelete}
      >
        <Trash />
      </button>
    </div>
  );
};

export default RollingStockEditorButtons;
