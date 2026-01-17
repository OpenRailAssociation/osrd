import { useMemo } from 'react';

import { Rocket } from '@osrd-project/ui-icons';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';

import { useScenarioContext } from 'applications/operationalStudies/hooks/useScenarioContext';
import type { TimetableJsonPayload } from 'applications/operationalStudies/types';
import { type PacedTrain, type TrainSchedule } from 'common/api/osrdEditoastApi';
import { Loader } from 'common/Loaders';
import { useSubCategoryContext } from 'common/SubCategoryContext';
import type { TimetableItem } from 'reducers/osrdconf/types';
import { useAppDispatch } from 'store';

import { generateTrainPayloads } from './helpers/generatePayloads';
import { postFullImportPayload } from './helpers/postPayloads';

function LoadingIfSearching({
  isLoading,
  t,
}: {
  isLoading: boolean;
  t: TFunction<'operational-studies', 'importTrains'>;
}) {
  return (
    <h1 className="text-center text-muted my-5">
      {isLoading ? <Loader position="center" /> : `${t('noResults')}`}
    </h1>
  );
}

type ImportTimetableItemTrainsListProps = {
  isLoading: boolean;
  trainsJsonData: TimetableJsonPayload;
  upsertTimetableItems: (timetableItems: TimetableItem[]) => void;
};

const ImportTimetableItemTrainsList = ({
  isLoading,
  trainsJsonData,
  upsertTimetableItems,
}: ImportTimetableItemTrainsListProps) => {
  const { t } = useTranslation('operational-studies', { keyPrefix: 'importTrains' });
  const dispatch = useAppDispatch();
  const { scenario, sandboxId } = useScenarioContext();
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

  const computedItemImportLabel = () => {
    const trainScheduleCount = trainSchedulesPayload.length;
    const pacedTrainCount = pacedTrainsPayload.length;

    if (trainScheduleCount > 0 && pacedTrainCount > 0) {
      return t('trainSchedulesAndPacedTrainsFound', { trainScheduleCount, pacedTrainCount });
    }
    if (trainScheduleCount > 0) {
      return t('trainSchedulesFound', { count: trainScheduleCount });
    }
    return t('pacedTrainsFound', { count: pacedTrainCount });
  };

  return trainSchedulesPayload.length > 0 || pacedTrainsPayload.length > 0 ? (
    <div className="container-fluid mb-2">
      <div className="osrd-config-item-container import-timetable-item-trainlist">
        <div className="import-timetable-item-trainlist-launchbar">
          <span
            className="import-timetable-item-trainlist-launchbar-nbresults"
            data-testid="import-timetable-item-results"
          >
            {computedItemImportLabel()}
          </span>
          <button
            data-testid="launch-import-button"
            className="btn btn-primary btn-sm ml-auto"
            type="button"
            onClick={() =>
              postFullImportPayload(
                sandboxId,
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
          >
            <Rocket />
            <span className="ml-3">{t('launchImport')}</span>
          </button>
        </div>
      </div>
    </div>
  ) : (
    <div className="container-fluid pb-2">
      <div className="osrd-config-item-container">
        <LoadingIfSearching isLoading={isLoading} t={t} />
      </div>
    </div>
  );
};

export default ImportTimetableItemTrainsList;
