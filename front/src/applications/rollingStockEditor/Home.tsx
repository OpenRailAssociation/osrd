import React, { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { enhancedEditoastApi } from 'common/api/enhancedEditoastApi';

import logo from 'assets/pictures/home/rollingstockeditor.svg';
import NavBarSNCF from 'common/BootstrapSNCF/NavBarSNCF';
import RollingStockEditor from './views/RollingStockEditor';

const HomeRollingStockEditor: FC = () => {
  const { t } = useTranslation(['home/home', 'referenceMap']);

  const { data: { results: rollingStocks } = { results: [] } } =
    enhancedEditoastApi.useGetLightRollingStockQuery({
      pageSize: 1000,
    });

  return (
    <>
      <NavBarSNCF appName={<>{t('rollingStockEditor')}</>} logo={logo} />
      <RollingStockEditor rollingStocks={rollingStocks} />
    </>
  );
};

export default HomeRollingStockEditor;
