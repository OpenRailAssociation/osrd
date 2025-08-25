import { useState } from 'react';

import type { TimetableJsonPayload } from 'applications/operationalStudies/types';
import type { GraouTrainSchedule } from 'common/api/graouApi';
import { type ScenarioResponse } from 'common/api/osrdEditoastApi';
import { Loader } from 'common/Loaders';
import { useRollingStockContext } from 'common/RollingStockContext';
import type { TimetableItem } from 'reducers/osrdconf/types';

import ImportTimetableItemConfig from './ImportTimetableItemConfig';
import ImportTimetableItemTrainsList from './ImportTimetableItemTrainsList';

type ImportTimetableItemProps = {
  scenario: ScenarioResponse;
  upsertTimetableItems: (timetableItems: TimetableItem[]) => void;
};

const ImportTimetableItem = ({ scenario, upsertTimetableItems }: ImportTimetableItemProps) => {
  const [trainsList, setTrainsList] = useState<GraouTrainSchedule[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [trainsJsonData, setTrainsJsonData] = useState<TimetableJsonPayload>({
    train_schedules: [],
    paced_trains: [],
  });

  const { rollingStocks } = useRollingStockContext();

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
