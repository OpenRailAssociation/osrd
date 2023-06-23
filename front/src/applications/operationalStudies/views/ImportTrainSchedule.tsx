import React, { useEffect, useState } from 'react';
import ImportTrainScheduleConfig from 'applications/operationalStudies/components/ImportTrainSchedule/ImportTrainScheduleConfig';
import ImportTrainScheduleTrainsList from 'applications/operationalStudies/components/ImportTrainSchedule/ImportTrainScheduleTrainsList';
import Loader from 'common/Loader';
import { TrainSchedule, TrainScheduleImportConfig } from 'applications/operationalStudies/types';
import { enhancedEditoastApi } from 'common/api/enhancedEditoastApi';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { setFailure } from 'reducers/main';
import { getInfraID } from 'reducers/osrdconf/selectors';

export default function ImportTrainSchedule() {
  const dispatch = useDispatch();
  const { t } = useTranslation(['rollingstock']);
  const [config, setConfig] = useState<TrainScheduleImportConfig | undefined>(undefined);
  const [trainsList, setTrainsList] = useState<TrainSchedule[] | undefined>(undefined);
  const infraId = useSelector(getInfraID);

  const { data: { results: rollingStocks } = { results: [] }, isError } =
    enhancedEditoastApi.useGetLightRollingStockQuery({
      pageSize: 1000,
    });

  const updateTrainslist = (trainsSchedules?: TrainSchedule[]) => {
    setTrainsList(trainsSchedules);
  };

  useEffect(() => {
    if (isError) {
      dispatch(
        setFailure({
          name: t('rollingstock:errorMessages.unableToRetrieveRollingStock'),
          message: t('rollingstock:errorMessages.unableToRetrieveRollingStockMessage'),
        })
      );
    }
  }, [isError]);

  return rollingStocks && infraId ? (
    <main className="import-train-schedule">
      <ImportTrainScheduleConfig
        setConfig={setConfig}
        setTrainsList={updateTrainslist}
        infraId={infraId}
      />
      <ImportTrainScheduleTrainsList
        config={config}
        trainsList={trainsList}
        setTrainList={updateTrainslist}
        rollingStockDB={rollingStocks}
      />
    </main>
  ) : (
    <Loader />
  );
}
