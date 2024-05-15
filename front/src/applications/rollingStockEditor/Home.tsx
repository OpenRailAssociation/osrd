import React, { type FC } from 'react';

import { useTranslation } from 'react-i18next';

import { ModalProvider } from 'common/BootstrapSNCF/ModalSNCF/ModalProvider';
import NavBarSNCF from 'common/BootstrapSNCF/NavBarSNCF';

import RollingStockEditor from './views/RollingStockEditor';

const HomeRollingStockEditor: FC = () => {
  const { t } = useTranslation(['home/home', 'referenceMap']);

  return (
    <ModalProvider>
      <NavBarSNCF appName={<>{t('rollingStockEditor')}</>} />
      <RollingStockEditor />
    </ModalProvider>
  );
};

export default HomeRollingStockEditor;
