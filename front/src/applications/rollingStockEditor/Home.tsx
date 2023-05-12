import React, { FC } from 'react';
import { useTranslation } from 'react-i18next';

import logo from 'assets/pictures/home/rs_editor.svg';
import NavBarSNCF from 'common/BootstrapSNCF/NavBarSNCF';

const HomeRollingStockEditor: FC = () => {
  const { t } = useTranslation(['home/home', 'referenceMap']);

  return <NavBarSNCF appName={<>{t('rollingStockEditor')}</>} logo={logo} />;
};

export default HomeRollingStockEditor;
