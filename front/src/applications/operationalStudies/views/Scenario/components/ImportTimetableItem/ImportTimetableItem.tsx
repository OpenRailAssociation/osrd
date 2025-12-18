import { useState } from 'react';

import type { TimetableJsonPayload } from 'applications/operationalStudies/types';
import { Loader } from 'common/Loaders';
import { useRollingStockContext } from 'common/RollingStockContext';
import type { TimetableItem } from 'reducers/osrdconf/types';

import ImportTimetableItemConfig from './ImportTimetableItemConfig';
import ImportTimetableItemTrainsList from './ImportTimetableItemTrainsList';

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

  return rollingStocks ? (
    <main className="import-timetable-item" data-testid="import-timetable-item">
      <ImportTimetableItemConfig
        setIsLoading={setIsLoading}
        setTrainsJsonData={setTrainsJsonData}
      />
      <ImportTimetableItemTrainsList
        isLoading={isLoading}
        trainsJsonData={trainsJsonData}
        upsertTimetableItems={upsertTimetableItems}
      />
    </main>
  ) : (
    <Loader />
  );
};

export default ImportTimetableItem;
