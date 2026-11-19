import { useCallback } from 'react';

import { Duplicate, Pencil, Trash } from '@osrd-project/ui-icons';
import cx from 'classnames';
import { useTranslation } from 'react-i18next';

import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import type { LightRollingStock, RollingStock } from 'common/api/osrdEditoastApi';
import ProtectedButton from 'common/authorization/components/ProtectedButton';
import type { Privilege } from 'common/authorization/types';
import { useModal } from 'common/BootstrapSNCF/ModalSNCF';
import { setSuccess, setFailure } from 'reducers/main';
import { useAppDispatch } from 'store';
import { castErrorToFailure, getErrorStatus } from 'utils/error';

import type { PageMode } from '../RollingStockEditorView';
import RollingStockEditorFormModal from './RollingStockEditorFormModal';

type RollingStockEditorButtonsProps = {
  rollingStock: LightRollingStock | RollingStock;
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
  const [deleteRollingStockById] =
    osrdEditoastApi.endpoints.deleteRollingStockByRollingStockId.useMutation();
  const [postRollingstock] = osrdEditoastApi.endpoints.postRollingStock.useMutation();

  const editRollingStock = useCallback(() => {
    setPageMode({ type: 'edit', rollingStockId: rollingStock.id });
  }, [setPageMode, rollingStock.id]);

  const duplicateRollingStock = useCallback(() => {
    const date = new Date().getTime().toString().slice(-3);
    if (!('inertia_coefficient' in rollingStock)) {
      throw new Error('Cannot duplicate a light rolling stock');
    }
    const duplicatedRollingStock = {
      ...rollingStock,
      name: `${rollingStock.name}-${date}`,
    };
    postRollingstock({
      locked: false,
      rollingStockForm: duplicatedRollingStock,
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
          setFailure(
            castErrorToFailure(error, {
              name: t('rollingStock.messages.failure'),
            })
          )
        );
      });
  }, [rollingStock, t, resetFilters, setPageMode, dispatch, postRollingstock]);

  const deleteRollingStock = useCallback(() => {
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
  }, [
    setPageMode,
    rollingStock.id,
    rollingStock.locked,
    t,
    openModal,
    deleteRollingStockById,
    dispatch,
  ]);

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
      {/* EDIT */}
      <ProtectedButton
        data-testid="rollingstock-edit-button"
        className="btn btn-primary bg-orange px-1 py-0"
        title={t('common.edit')}
        onClick={editRollingStock}
        userPrivileges={userPrivileges}
        requiredPrivileges={['can_write']}
        disabled={rollingStock.locked || !userPrivileges.has('can_write')}
      >
        <Pencil />
      </ProtectedButton>

      {/* DUPLICATE */}
      <ProtectedButton
        data-testid="rollingstock-duplicate-button"
        className="btn btn-primary px-1 py-0"
        title={t('common.duplicate')}
        userPrivileges={userPrivileges}
        requiredPrivileges={['can_read']}
        onClick={duplicateRollingStock}
      >
        <Duplicate />
      </ProtectedButton>

      {/* DELETE */}
      <ProtectedButton
        data-testid="rollingstock-delete-button"
        className="btn btn-primary bg-red px-1 py-0"
        title={t('common.delete')}
        userPrivileges={userPrivileges}
        requiredPrivileges={['can_delete']}
        onClick={confirmDelete}
        disabled={rollingStock.locked || !userPrivileges.has('can_delete')}
      >
        <Trash />
      </ProtectedButton>
    </div>
  );
};

export default RollingStockEditorButtons;
