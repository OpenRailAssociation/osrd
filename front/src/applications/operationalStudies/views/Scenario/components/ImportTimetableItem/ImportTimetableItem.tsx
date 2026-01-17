import { useMemo, useState } from 'react';

import { useTranslation } from 'react-i18next';

import { useScenarioContext } from 'applications/operationalStudies/hooks/useScenarioContext';
import type { TimetableJsonPayload } from 'applications/operationalStudies/types';
import type { PacedTrain, TrainSchedule } from 'common/api/osrdEditoastApi';
import { Loader } from 'common/Loaders';
import { useRollingStockContext } from 'common/RollingStockContext';
import { useSubCategoryContext } from 'common/SubCategoryContext';
import type { TimetableItem } from 'reducers/osrdconf/types';
import { useAppDispatch } from 'store';

import { generateTrainPayloads } from './helpers/generatePayloads';
import { postFullImportPayload } from './helpers/postPayloads';
import ImportTimetableItemConfig from './ImportTimetableItemConfig';

type ImportTimetableItemProps = {
  upsertTimetableItems: (timetableItems: TimetableItem[]) => void;
};

const ImportTimetableItem = ({ upsertTimetableItems }: ImportTimetableItemProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [trainsJsonData, setTrainsJsonData] = useState<TimetableJsonPayload>({
    train_schedules: [],
    paced_trains: [],
  });

  const { rollingStocks } = useRollingStockContext();

  const { t } = useTranslation('operational-studies', { keyPrefix: 'importTrains' });
  const dispatch = useAppDispatch();
  const { scenario } = useScenarioContext();
  const {
    train_schedules: parsedTrainSchedules,
    paced_trains: parsedPacedTrains,
    macro_nodes: macroNodes,
    macro_notes: macroNotes,
    round_trips: roundTripsFromJsonData,
  } = trainsJsonData;

  const subCategories = useSubCategoryContext();

  const { pacedTrainsPayload, trainSchedulesPayload } = useMemo<{
    pacedTrainsPayload: PacedTrain[];
    trainSchedulesPayload: TrainSchedule[];
  }>(
    () => generateTrainPayloads(parsedPacedTrains, parsedTrainSchedules, subCategories),
    [parsedPacedTrains, parsedTrainSchedules, subCategories]
  );

  const timetableId = scenario.timetable_id;

  return !isLoading && rollingStocks ? (
    <main className="import-timetable-item" data-testid="import-timetable-item">
      <ImportTimetableItemConfig
        setIsLoading={setIsLoading}
        setTrainsJsonData={setTrainsJsonData}
      />
      <button
        data-testid="launch-import-button"
        className="btn btn-primary btn-sm ml-auto"
        type="button"
        onClick={() =>
          postFullImportPayload(
            timetableId,
            scenario.id,
            [...trainSchedulesPayload, ...pacedTrainsPayload],
            roundTripsFromJsonData,
            macroNodes,
            macroNotes,
            dispatch,
            t,
            upsertTimetableItems
          )
        }
      />
    </main>
  ) : (
    <Loader />
  );
};

export default ImportTimetableItem;
