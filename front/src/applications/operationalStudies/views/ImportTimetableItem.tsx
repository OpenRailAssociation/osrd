import { useEffect, useState } from 'react';

import { useTranslation } from 'react-i18next';

import type {
  ImportedTrainSchedule,
  TimetableJsonPayload,
} from 'applications/operationalStudies/types';
import { osrdEditoastApi, type ScenarioResponse } from 'common/api/osrdEditoastApi';
import { Loader } from 'common/Loaders';
import {
  ImportTimetableItemConfig,
  ImportTimetableItemTrainsList,
} from 'modules/trainschedule/components/ImportTimetableItem';
import { setFailure } from 'reducers/main';
import type { TimetableItem } from 'reducers/osrdconf/types';
import { useAppDispatch } from 'store';

type ImportTimetableItemProps = {
  scenario: ScenarioResponse;
  upsertTimetableItems: (timetableItems: TimetableItem[]) => void;
};

const ImportTimetableItem = ({ scenario, upsertTimetableItems }: ImportTimetableItemProps) => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation();
  const [trainsList, setTrainsList] = useState<ImportedTrainSchedule[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [trainsJsonData, setTrainsJsonData] = useState<TimetableJsonPayload>({
    train_schedules: [],
    paced_trains: [],
  });

  const { data: { results: rollingStocks } = { results: [] }, isError } =
    osrdEditoastApi.endpoints.getLightRollingStock.useQuery({
      pageSize: 1000,
    });

  useEffect(() => {
    if (isError) {
      dispatch(
        setFailure({
          name: t('rollingStock.errorMessages.unableToRetrieveRollingStock'),
          message: t('rollingStock.errorMessages.unableToRetrieveRollingStockMessage'),
        })
      );
    }
  }, [isError]);

  return rollingStocks ? (
    <main className="import-timetable-item">
      <ImportTimetableItemConfig
        setIsLoading={setIsLoading}
        setTrainsList={setTrainsList}
        setTrainsJsonData={setTrainsJsonData}
      />
      <ImportTimetableItemTrainsList
        isLoading={isLoading}
        scenario={scenario}
        trainsList={trainsList}
        trainsJsonData={trainsJsonData}
        upsertTimetableItems={upsertTimetableItems}
      />
    </main>
  ) : (
    <Loader />
  );
};

export default ImportTimetableItem;
