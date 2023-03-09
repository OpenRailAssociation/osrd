import React, { FC } from 'react';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';

import { OsrdConfState } from 'applications/operationalStudies/consts';
import { Modal } from 'common/BootstrapSNCF/ModalSNCF';
import InfraErrorsList from './InfraErrorsList';
import { InfraError } from './types';

interface InfraErrorsModalProps {
  onErrorClick: (infraId: number, item: InfraError) => void | Promise<void>;
}

const InfraErrorsModal: FC<InfraErrorsModalProps> = ({ onErrorClick }) => {
  const { t } = useTranslation();
  const infraID = useSelector((state: { osrdconf: OsrdConfState }) => state.osrdconf.infraID);

  return (
    <Modal title={t('Editor.infra-errors.modal.title', { id: infraID })}>
      {infraID && <InfraErrorsList infraID={infraID} onErrorClick={onErrorClick} />}
    </Modal>
  );
};

export default InfraErrorsModal;
