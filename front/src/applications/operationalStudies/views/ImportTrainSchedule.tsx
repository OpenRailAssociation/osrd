import React, { useEffect, useState } from 'react';
import ImportTrainScheduleConfig from 'applications/operationalStudies/components/ImportTrainSchedule/ImportTrainScheduleConfig';
import ImportTrainScheduleTrainsList from 'applications/operationalStudies/components/ImportTrainSchedule/ImportTrainScheduleTrainsList';
import { get } from 'common/requests';
import Loader from 'common/Loader';
import { TrainSchedule, TrainScheduleImportConfig } from 'applications/operationalStudies/types';

const ROLLING_STOCK_URL = '/editoast/light_rolling_stock/';

export default function ImportTrainSchedule() {
  const [config, setConfig] = useState<TrainScheduleImportConfig | undefined>(undefined);
  const [trainsList, setTrainsList] = useState<TrainSchedule[] | undefined>(undefined);
  const [rollingStockDB, setRollingStockDB] = useState();

  async function getRollingStockDB() {
    try {
      const data = await get(ROLLING_STOCK_URL, { params: { page_size: 1000 } });
      setRollingStockDB(data.results);
    } catch (error) {
      console.error(error);
    }
  }

  const updateTrainslist = (trainsSchedules?: TrainSchedule[]) => {
    setTrainsList(trainsSchedules);
  };

  useEffect(() => {
    if (!rollingStockDB) {
      getRollingStockDB();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return rollingStockDB ? (
    <main className="import-train-schedule">
      <ImportTrainScheduleConfig setConfig={setConfig} setTrainsList={updateTrainslist} />
      <ImportTrainScheduleTrainsList
        config={config}
        trainsList={trainsList}
        setTrainList={updateTrainslist}
        rollingStockDB={rollingStockDB}
      />
    </main>
  ) : (
    <Loader />
  );
}
