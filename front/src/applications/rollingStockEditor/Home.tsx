import React, { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { enhancedEditoastApi } from 'common/api/enhancedEditoastApi';

import NavBarSNCF from 'common/BootstrapSNCF/NavBarSNCF';
import { ModalProvider } from 'common/BootstrapSNCF/ModalSNCF/ModalProvider';
import RollingStockEditor from './views/RollingStockEditor';

const HomeRollingStockEditor: FC = () => {
  const { t } = useTranslation(['home/home', 'referenceMap']);

  const { data: { results: rollingStocks } = { results: [] } } =
    enhancedEditoastApi.useGetLightRollingStockQuery({
      pageSize: 1000,
    });

  return (
    <ModalProvider>
      <NavBarSNCF appName={<>{t('rollingStockEditor')}</>} />
      <RollingStockEditor rollingStocks={rollingStocks} />
    </ModalProvider>
  );
};

export default HomeRollingStockEditor;
