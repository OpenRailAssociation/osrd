import { useState } from 'react';

import { useTranslation } from 'react-i18next';

import { OPERATION_TYPE } from 'applications/editor/consts';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { ConfirmModal, useModal } from 'common/BootstrapSNCF/ModalSNCF';
import { Loader } from 'common/Loaders';
import { useInfraID } from 'common/osrdContext';
import { saveOperations } from 'reducers/editor/thunkActions';
import { useAppDispatch } from 'store';

const InfraErrorCorrectorModal = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { closeModal } = useModal();
  const infraId = useInfraID();
  const [isSaving, setIsSaving] = useState(false);

  const { data: infraAutoFixes, isLoading } =
    osrdEditoastApi.endpoints.getInfraByInfraIdAutoFixes.useQuery(
      { infraId: infraId as number },
      { skip: !infraId }
    );

  function displayFixes() {
    if (!infraAutoFixes || isLoading || isSaving) {
      return (
        <Loader
          msg={t(
            `Editor.infra-errors.corrector-modal.${isLoading ? 'loading-loader' : 'saving-loader'}`
          )}
        />
      );
    }
    if (infraAutoFixes?.length === 0) {
      return <p>{t('Editor.infra-errors.corrector-modal.total-fixes_zero')}</p>;
    }
    const creationCount = infraAutoFixes.filter(
      (operation) => operation.operation_type === OPERATION_TYPE.CREATE
    ).length;
    const updateCount = infraAutoFixes.filter(
      (operation) => operation.operation_type === OPERATION_TYPE.UPDATE
    ).length;
    const deletionCount = infraAutoFixes.length - creationCount - updateCount;
    return (
      <>
        <p>{t('Editor.infra-errors.corrector-modal.text')}</p>
        <ul>
          <li>
            {t('Editor.infra-errors.corrector-modal.create-actions', {
              creation_count: creationCount,
            })}
          </li>
          <li>
            {t('Editor.infra-errors.corrector-modal.update-actions', { update_count: updateCount })}
          </li>
          <li>
            {t('Editor.infra-errors.corrector-modal.delete-actions', {
              deletion_count: deletionCount,
            })}
          </li>
        </ul>
      </>
    );
  }

  return (
    <ConfirmModal
      title={t('Editor.infra-errors.corrector-modal.title')}
      confirmDisabled={isLoading}
      onConfirm={async () => {
        if (infraAutoFixes?.length !== 0) {
          setIsSaving(true);
          await dispatch(saveOperations(infraId, infraAutoFixes!, false));
        }
        closeModal();
      }}
      withCloseButton={false}
    >
      {displayFixes()}
    </ConfirmModal>
  );
};

export default InfraErrorCorrectorModal;
