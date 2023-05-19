import React, { FC, useState } from 'react';
import { useTranslation } from 'react-i18next';

import logo from 'assets/pictures/home/rollingstockeditor.svg';
import NavBarSNCF from 'common/BootstrapSNCF/NavBarSNCF';
import Loader from 'common/Loader';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { sortBy } from 'lodash';
import RollingStockEditor from './RollingStockEditor';
import 'styles/main.css';

const HomeRollingStockEditor: FC = () => {
  const { t } = useTranslation(['home/home', 'referenceMap']);
  const [openedRollingStockCardId, setOpenedRollingStockCardId] = useState<number>();

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
      <div className="d-flex pl-0 flex-column mastcontainer">
        {rollingStocks.length > 0 ? (
          rollingStocks.map((item) => (
            <RollingStockEditor
              data={item}
              openedRollingStockCardId={openedRollingStockCardId}
              setOpenedRollingStockCardId={setOpenedRollingStockCardId}
            />
          ))
        ) : (
          <Loader msg={t('rollingstock:waitingLoader')} />
        )}
      </div>
    </>
  );
};

export default HomeRollingStockEditor;
