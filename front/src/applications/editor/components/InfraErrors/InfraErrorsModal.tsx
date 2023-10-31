import React, { FC } from 'react';
import { useTranslation } from 'react-i18next';

import { Modal } from 'common/BootstrapSNCF/ModalSNCF';
import { useInfraID } from 'common/osrdContext';

import InfraErrorsList from './InfraErrorsList';
import type { InfraError } from './types';

interface InfraErrorsModalProps {
  onErrorClick: (infraId: number, item: InfraError) => void | Promise<void>;
}

const InfraErrorsModal: FC<InfraErrorsModalProps> = ({ onErrorClick }) => {
  const { t } = useTranslation();
  const infraID = useInfraID();

  return (
    <Modal title={t('Editor.infra-errors.modal.title', { id: infraID })}>
      {infraID && <InfraErrorsList infraID={infraID} onErrorClick={onErrorClick} />}
    </Modal>
  );
};

export default InfraErrorsModal;
