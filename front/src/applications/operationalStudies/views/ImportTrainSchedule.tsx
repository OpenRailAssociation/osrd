import React, { useEffect, useState } from 'react';
import ImportTrainScheduleConfig from 'applications/operationalStudies/components/ImportTrainSchedule/ImportTrainScheduleConfig';
import ImportTrainScheduleTrainsList from 'applications/operationalStudies/components/ImportTrainSchedule/ImportTrainScheduleTrainsList';
import Loader from 'common/Loader';
import { TrainSchedule } from 'applications/operationalStudies/types';
import { enhancedEditoastApi } from 'common/api/enhancedEditoastApi';
import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { setFailure } from 'reducers/main';

export default function ImportTrainSchedule({ infraId }: { infraId: number }) {
  const dispatch = useDispatch();
  const { t } = useTranslation(['rollingstock']);
  const [trainsList, setTrainsList] = useState<TrainSchedule[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const { data: { results: rollingStocks } = { results: [] }, isError } =
    enhancedEditoastApi.useGetLightRollingStockQuery({
      pageSize: 1000,
    });

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

  return rollingStocks ? (
    <main className="import-train-schedule">
      <ImportTrainScheduleConfig
        setIsLoading={setIsLoading}
        setTrainsList={setTrainsList}
        infraId={infraId}
      />
      <ImportTrainScheduleTrainsList
        trainsList={trainsList}
        rollingStockDB={rollingStocks}
        isLoading={isLoading}
      />
    </main>
  ) : (
    <Loader />
  );
}
