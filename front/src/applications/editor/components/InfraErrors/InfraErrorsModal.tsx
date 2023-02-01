import React from 'react';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';

import { OsrdConfState } from 'applications/operationalStudies/consts';
import Modal from '../Modal';
import { ModalProps } from '../../tools/types';
import InfraErrorsList from './InfraErrorsList';

const InfraErrorsModal: React.FC<ModalProps> = ({ cancel }) => {
  const { t } = useTranslation();
  const infraID = useSelector((state: { osrdconf: OsrdConfState }) => state.osrdconf.infraID);

  return (
    <Modal onClose={cancel} title={t('Editor.infra-errors.modal.title', { id: infraID })}>
      {infraID && <InfraErrorsList infraID={infraID} />}
    </Modal>
  );
};

export default InfraErrorsModal;
