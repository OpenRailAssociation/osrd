import { useTranslation } from 'react-i18next';

import type { InfraError } from 'common/api/osrdEditoastApi';
import { Modal } from 'common/BootstrapSNCF/ModalSNCF';
import { useInfraID } from 'common/osrdContext';

import InfraErrorsList from './InfraErrorsList';

interface InfraErrorsModalProps {
  onErrorClick: (infraId: number, item: InfraError) => void | Promise<void>;
}

const InfraErrorsModal = ({ onErrorClick }: InfraErrorsModalProps) => {
  const { t } = useTranslation();
  const infraID = useInfraID();

  return (
    <Modal title={t('Editor.infra-errors.modal.title', { id: infraID })}>
      {infraID && <InfraErrorsList infraID={infraID} onErrorClick={onErrorClick} />}
    </Modal>
  );
};

export default InfraErrorsModal;
