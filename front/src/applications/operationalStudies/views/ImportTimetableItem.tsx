import { useEffect, useState } from 'react';

import { useTranslation } from 'react-i18next';

import type {
  ImportedTrainSchedule,
  TimetableJsonPayload,
} from 'applications/operationalStudies/types';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { Loader } from 'common/Loaders';
import {
  ImportTimetableItemConfig,
  ImportTimetableItemTrainsList,
} from 'modules/trainschedule/components/ImportTimetableItem';
import { setFailure } from 'reducers/main';
import type { TimetableItemWithTimetableId } from 'reducers/osrdconf/types';
import { useAppDispatch } from 'store';

type ImportTimetableItemProps = {
  timetableId: number;
  upsertTimetableItems: (timetableItems: TimetableItemWithTimetableId[]) => void;
  dtoImport: () => void;
};

const ImportTimetableItem = ({
  timetableId,
  upsertTimetableItems,
  dtoImport,
}: ImportTimetableItemProps) => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation(['rollingstock']);
  const [trainsList, setTrainsList] = useState<ImportedTrainSchedule[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [trainsJsonData, setTrainsJsonData] = useState<TimetableJsonPayload>({
    train_schedules: [],
    paced_trains: [],
  });
  const [trainsXmlData, setTrainsXmlData] = useState<ImportedTrainSchedule[]>([]);

  const { data: { results: rollingStocks } = { results: [] }, isError } =
    osrdEditoastApi.endpoints.getLightRollingStock.useQuery({
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
    <main className="import-timetable-item">
      <ImportTimetableItemConfig
        setIsLoading={setIsLoading}
        setTrainsList={setTrainsList}
        setTrainsJsonData={setTrainsJsonData}
        setTrainsXmlData={setTrainsXmlData}
      />
      <ImportTimetableItemTrainsList
        isLoading={isLoading}
        timetableId={timetableId}
        trainsList={trainsList}
        trainsJsonData={trainsJsonData}
        trainsXmlData={trainsXmlData}
        upsertTimetableItems={upsertTimetableItems}
        dtoImport={dtoImport}
      />
    </main>
  ) : (
    <Loader />
  );
};

export default ImportTimetableItem;
