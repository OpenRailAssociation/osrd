import React, { useEffect, useState } from 'react';
import OpenDataImportConfig from 'applications/opendata/views/OpenDataImportConfig';
import OpenDataTrainsList from 'applications/opendata/views/OpenDataTrainsList';
import OpenDataGlobalSettings from 'applications/opendata/views/OpenDataGlobalSettings';
import { get } from 'common/requests';
import Loader from 'common/Loader';

const ROLLING_STOCK_URL = '/light_rolling_stock/';

export default function OpenDataImport() {
  const [config, setConfig] = useState();
  const [rollingStockDB, setRollingStockDB] = useState();

  async function getRollingStockDB() {
    try {
      const data = await get(ROLLING_STOCK_URL, { page_size: 1000 });
      setRollingStockDB(data.results);
    } catch (error) {
      console.log(error);
    }
  }

  useEffect(() => {
    if (!rollingStockDB) {
      getRollingStockDB();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return rollingStockDB ? (
    <main className="osrd-config-mastcontainer mastcontainer opendata-import">
      <div className="p-3">
        <OpenDataImportConfig setConfig={setConfig} />
        <OpenDataGlobalSettings />
        <OpenDataTrainsList config={config} rollingStockDB={rollingStockDB} />
      </div>
    </main>
  ) : (
    <Loader />
  );
}
