import React, { FC } from 'react';
import { useTranslation } from 'react-i18next';

import { Modal } from 'common/BootstrapSNCF/ModalSNCF/Modal';

const HelpModal: FC = () => {
  const { t } = useTranslation();

  return (
    <Modal title={t('common.help')}>
      <p>{t('Editor.linear-metadata.help')}</p>
    </Modal>
  );
};

export default HelpModal;
