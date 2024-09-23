import { useEffect, useState } from 'react';

import { useTranslation } from 'react-i18next';

import type { ImportedTrainSchedule } from 'applications/operationalStudies/types';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import type { TrainScheduleBase, TrainScheduleResult } from 'common/api/osrdEditoastApi';
import { Loader } from 'common/Loaders';
import { ImportTrainScheduleConfig } from 'modules/trainschedule/components/ImportTrainSchedule';
import ImportTrainScheduleTrainsList from 'modules/trainschedule/components/ImportTrainSchedule/ImportTrainScheduleTrainsList';
import { notifyFailure } from 'reducers/main';
import { useAppDispatch } from 'store';

const ImportTrainSchedule = ({
  timetableId,
  upsertTrainSchedules,
}: {
  timetableId: number;
  upsertTrainSchedules: (trainSchedules: TrainScheduleResult[]) => void;
}) => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation(['rollingstock']);
  const [trainsList, setTrainsList] = useState<ImportedTrainSchedule[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [trainsJsonData, setTrainsJsonData] = useState<TrainScheduleBase[]>([]);

  const { data: { results: rollingStocks } = { results: [] }, isError } =
    osrdEditoastApi.endpoints.getLightRollingStock.useQuery({
      pageSize: 1000,
    });

  useEffect(() => {
    if (isError) {
      dispatch(
        notifyFailure({
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
        setTrainsJsonData={setTrainsJsonData}
      />
      <ImportTrainScheduleTrainsList
        isLoading={isLoading}
        rollingStocks={rollingStocks}
        timetableId={timetableId}
        trainsList={trainsList}
        trainsJsonData={trainsJsonData}
        upsertTrainSchedules={upsertTrainSchedules}
      />
    </main>
  ) : (
    <Loader />
  );
};

export default ImportTrainSchedule;
