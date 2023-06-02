import React, { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { sortBy } from 'lodash';

import logo from 'assets/pictures/home/rollingstockeditor.svg';
import NavBarSNCF from 'common/BootstrapSNCF/NavBarSNCF';
import RollingStockEditor from './views/RollingStockEditor';
import 'styles/main.css';

const HomeRollingStockEditor: FC = () => {
  const { t } = useTranslation(['home/home', 'referenceMap']);

  const { rollingStocks } = osrdEditoastApi.useGetLightRollingStockQuery(
    {
      pageSize: 100,
    },
    {
      selectFromResult: (response) => ({
        ...response,
        rollingStocks: sortBy(response.data?.results, ['metadata.reference', 'name']) || [],
      }),
    }
  );

  return (
    <>
      <NavBarSNCF appName={<>{t('rollingStockEditor')}</>} logo={logo} />
      <RollingStockEditor rollingStocks={rollingStocks} />
    </>
  );
};

export default HomeRollingStockEditor;
