import { useMemo } from 'react';

import { Rocket } from '@osrd-project/ui-icons';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';

import { useScenarioContext } from 'applications/operationalStudies/hooks/useScenarioContext';
import type {
  RoundTripsFromJson,
  TimetableJsonPayload,
} from 'applications/operationalStudies/types';
import {
  osrdEditoastApi,
  type MacroNodeForm,
  type PacedTrain,
  type TrainSchedule,
} from 'common/api/osrdEditoastApi';
import { Loader } from 'common/Loaders';
import { useSubCategoryContext } from 'common/SubCategoryContext';
import { setFailure, setSuccess, setWarning } from 'reducers/main';
import type { TimetableItem } from 'reducers/osrdconf/types';
import { useAppDispatch } from 'store';
import { extractEditoastIdFromPacedTrainId } from 'utils/trainId';

import { generateRoundTripsPayload, generateTrainPayloads } from './helpers/generatePayloads';
import postTimetableItems from './helpers/postTimetableItems';

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

  const [postPacedTrainRoundTrips] =
    osrdEditoastApi.endpoints.postRoundTripsPacedTrains.useMutation();
  const [postMacroNodes] = osrdEditoastApi.endpoints.postMacroNodes.useMutation();
  const [postMacroNotes] = osrdEditoastApi.endpoints.postMacroNotes.useMutation();

  const timetableId = scenario.timetable_id;

  const postRoundTrips = async (
    roundTrips: RoundTripsFromJson,
    formattedPacedTrains: TimetableItem[]
  ): Promise<void> => {
    if (roundTrips.paced_trains.length > 0) {
      const payload = generateRoundTripsPayload(
        roundTrips.paced_trains,
        formattedPacedTrains,
        extractEditoastIdFromPacedTrainId
      );
      await postPacedTrainRoundTrips(payload).unwrap();
    }
  };

  /**
   * Post macro nodes if their trigrams are not already present in the database.
   * Displays a warning to the user if any nodes do not get posted.
   */
  const postMacroNodesIfNew = async (nodes: MacroNodeForm[]): Promise<void> => {
    const storedNodes = await dispatch(
      osrdEditoastApi.endpoints.getAllMacroNodes.initiate(
        {
          scenarioId: scenario.id,
        },
        { subscribe: false }
      )
    ).unwrap();
    const storedNodesKeys = new Set(storedNodes.map((node) => node.path_item_key));
    const newMacroNodes = nodes.filter((node) => !storedNodesKeys.has(node.path_item_key));
    if (newMacroNodes.length > 0) {
      await postMacroNodes({
        macroNodeBatchForm: { macro_nodes: newMacroNodes, scenario_id: scenario.id },
      }).unwrap();
    }
    const ignoredNodesCount = nodes.length - newMacroNodes.length;
    if (ignoredNodesCount)
      dispatch(
        setWarning({
          title: t('warningMessages.warning'),
          text: t('warningMessages.alreadyPresentNode', {
            count: ignoredNodesCount,
          }),
        })
      );
  };

  async function generateTimetableItem() {
    try {
      const timetableItems = await postTimetableItems(
        timetableId,
        [...trainSchedulesPayload, ...pacedTrainsPayload],
        dispatch
      );

      if (roundTripsFromJsonData) {
        await postRoundTrips(roundTripsFromJsonData, timetableItems);
      }

      if (macroNodes && macroNodes.length > 0) {
        await postMacroNodesIfNew(macroNodes);
      }

      if (macroNotes && macroNotes.length > 0) {
        await postMacroNotes({
          macroNoteBatchForm: { macro_notes: macroNotes, scenario_id: scenario.id },
        }).unwrap();
      }

      upsertTimetableItems(timetableItems);

      dispatch(
        setSuccess({
          title: t('success'),
          text: t('status.successfulImport', {
            count: [...trainSchedulesPayload, ...pacedTrainsPayload].length,
          }),
        })
      );
    } catch (error) {
      dispatch(
        setFailure({
          name: t('failure'),
          message: t('status.invalidTimetableItems', {
            count: [...trainSchedulesPayload, ...pacedTrainsPayload].length,
          }),
        })
      );
      throw error;
    }
  }

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
            onClick={() => generateTimetableItem()}
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
