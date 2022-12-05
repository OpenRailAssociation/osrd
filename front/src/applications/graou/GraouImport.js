import React, { useEffect, useState } from 'react';
import GraouImportConfig from 'applications/graou/views/GraouImportConfig';
import GraouTrainsList from 'applications/graou/views/GraouTrainsList';
import GraouGlobalSettings from 'applications/graou/views/GraouGlobalSettings';
import { get } from 'common/requests';
import Loader from 'common/Loader';

const ROLLING_STOCK_URL = '/light_rolling_stock/';

export default function GraouImport() {
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
    <main className="osrd-config-mastcontainer mastcontainer graou-import">
      <div className="p-3">
        <GraouImportConfig setConfig={setConfig} />
        <GraouGlobalSettings />
        <GraouTrainsList config={config} rollingStockDB={rollingStockDB} />
      </div>
    </main>
  ) : (
    <Loader />
  );
}
