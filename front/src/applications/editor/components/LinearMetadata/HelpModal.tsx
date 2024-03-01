import React, { type FC } from 'react';

import { useTranslation } from 'react-i18next';

import { Modal } from 'common/BootstrapSNCF/ModalSNCF';

const HelpModal: FC = () => {
  const { t } = useTranslation();

  return (
    <Modal title={t('common.help')}>
      <p>{t('Editor.linear-metadata.help')}</p>
    </Modal>
  );
};

export default HelpModal;
