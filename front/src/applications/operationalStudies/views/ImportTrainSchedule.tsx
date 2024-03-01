import React, { useEffect, useState } from 'react';
import {
  ImportTrainScheduleConfig,
  ImportTrainScheduleTrainsList,
} from 'modules/trainschedule/components/ImportTrainSchedule';
import { Loader } from 'common/Loaders';
import type { TrainSchedule } from 'applications/operationalStudies/types';
import { enhancedEditoastApi } from 'common/api/enhancedEditoastApi';
import { useTranslation } from 'react-i18next';
import { useAppDispatch } from 'store';
import { setFailure } from 'reducers/main';

export default function ImportTrainSchedule({
  infraId,
  timetableId,
}: {
  infraId: number;
  timetableId: number;
}) {
  const dispatch = useAppDispatch();
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
        infraId={infraId}
        isLoading={isLoading}
        rollingStocks={rollingStocks}
        timetableId={timetableId}
        trainsList={trainsList}
      />
    </main>
  ) : (
    <Loader />
  );
}
