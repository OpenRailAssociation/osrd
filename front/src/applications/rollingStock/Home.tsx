import React, { FC } from 'react';
import { useTranslation } from 'react-i18next';

import logo from 'assets/pictures/home/rolling-stock.svg';
import NavBarSNCF from 'common/BootstrapSNCF/NavBarSNCF';

const HomeRollingStock: FC = () => {
  const { t } = useTranslation(['home/home', 'referenceMap']);

  return <NavBarSNCF appName={<>{t('rollingStock')}</>} logo={logo} />;
};

export default HomeRollingStock;
