import { useMemo } from 'react';

import { Rocket } from '@osrd-project/ui-icons';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';

import { useScenarioContext } from 'applications/operationalStudies/hooks/useScenarioContext';
import type {
  RoundTripsFromJson,
  TimetableJsonPayload,
} from 'applications/operationalStudies/types';
import type { GraouTrainSchedule } from 'common/api/graouApi';
import {
  osrdEditoastApi,
  type PacedTrain,
  type TrainSchedule,
  type TrainCategory,
  type TrainMainCategory,
} from 'common/api/osrdEditoastApi';
import { Loader } from 'common/Loaders';
import { useSubCategoryContext } from 'common/SubCategoryContext';
import { TrainMainCategoryDict } from 'modules/rollingStock/consts';
import isMainCategory from 'modules/rollingStock/helpers/category';
import { setFailure, setSuccess } from 'reducers/main';
import type {
  PacedTrainWithPacedTrainId,
  TimetableItem,
  TrainScheduleWithTrainId,
} from 'reducers/osrdconf/types';
import { useAppDispatch } from 'store';
import {
  extractEditoastIdFromPacedTrainId,
  extractEditoastIdFromTrainScheduleId,
  formatEditoastIdToPacedTrainId,
  formatEditoastIdToTrainScheduleId,
} from 'utils/trainId';

import generateTrainSchedulesPayloads from './generateTrainSchedulesPayloads';
import findValidTrainNameKey from './helpers/findValidTrainNameKey';
import rollingstockOpenData2OSRD from './rollingstock_opendata2osrd.json';

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
  trainsList: GraouTrainSchedule[];
  isLoading: boolean;
  trainsJsonData: TimetableJsonPayload;
  upsertTimetableItems: (timetableItems: TimetableItem[]) => void;
};

const ImportTimetableItemTrainsList = ({
  trainsList,
  isLoading,
  trainsJsonData,
  upsertTimetableItems,
}: ImportTimetableItemTrainsListProps) => {
  const { t } = useTranslation('operational-studies', { keyPrefix: 'importTrains' });
  const { scenario } = useScenarioContext();
  const {
    train_schedules: trainSchedulesFromJsonData,
    paced_trains: pacedTrainsFromJsonData,
    macro_nodes: macroNodes,
    round_trips: roundTripsFromJsonData,
  } = trainsJsonData;

  const subCategories = useSubCategoryContext();

  const isTrainMainCategory = (v: string): v is TrainMainCategory => v in TrainMainCategoryDict;

  const checkCategory = (category?: TrainCategory | string | null): TrainCategory | null => {
    if (!category) return null;

    // This condition is added for train imports that still use the old format: `category: string`
    if (typeof category === 'string') {
      return isTrainMainCategory(category) ? { main_category: category } : null;
    }

    if (isMainCategory(category)) {
      return isTrainMainCategory(category.main_category) ? category : null;
    }

    const hasValidSubCategory = subCategories.some(
      (subCategory) => subCategory.code === category.sub_category_code
    );
    return hasValidSubCategory ? category : null;
  };

  const unrecognizedCategoryToLabel = (category?: TrainCategory | string | null): string | null => {
    if (!category || checkCategory(category)) return null;
    if (typeof category === 'string') {
      return category;
    }
    if (isMainCategory(category)) {
      return category.main_category;
    }
    return category.sub_category_code;
  };

  const buildLabels = (
    labels: string[] | undefined,
    category?: TrainCategory | string | null
  ): string[] | undefined => {
    const unrecognizedCategoryLabel = unrecognizedCategoryToLabel(category);
    if (!unrecognizedCategoryLabel) return labels;
    if (!labels) return [unrecognizedCategoryLabel];
    if (labels.includes(unrecognizedCategoryLabel)) return labels;
    return [...labels, unrecognizedCategoryLabel];
  };

  const { pacedTrainsJsonData, trainSchedulesJsonData } = useMemo<{
    pacedTrainsJsonData: PacedTrain[];
    trainSchedulesJsonData: TrainSchedule[];
  }>(
    () => ({
      pacedTrainsJsonData: pacedTrainsFromJsonData.map((pacedTrain) => ({
        ...pacedTrain,
        category: checkCategory(pacedTrain.category),
        labels: buildLabels(pacedTrain.labels, pacedTrain.category),
      })),
      trainSchedulesJsonData: trainSchedulesFromJsonData.map((trainSchedule) => ({
        ...trainSchedule,
        category: checkCategory(trainSchedule.category),
        labels: buildLabels(trainSchedule.labels, trainSchedule.category),
      })),
    }),
    [pacedTrainsFromJsonData, trainSchedulesFromJsonData, subCategories]
  );

  const formattedTrainsList = useMemo(
    () =>
      trainsList.map(({ rollingStock, ...train }) => {
        if (!rollingStock) return { ...train, rollingStock: '' };

        const validTrainNameKey = findValidTrainNameKey(rollingStock);
        const validTrainName = validTrainNameKey
          ? rollingstockOpenData2OSRD[validTrainNameKey]
          : rollingStock;

        return { ...train, rollingStock: validTrainName };
      }),
    [trainsList]
  );

  const [postTrainSchedule] =
    osrdEditoastApi.endpoints.postTimetableByIdTrainSchedules.useMutation();
  const [postPacedTrain] = osrdEditoastApi.endpoints.postTimetableByIdPacedTrains.useMutation();
  const [postTrainScheduleRoundTrips] =
    osrdEditoastApi.endpoints.postRoundTripsTrainSchedules.useMutation();
  const [postPacedTrainRoundTrips] =
    osrdEditoastApi.endpoints.postRoundTripsPacedTrains.useMutation();
  const [postMacroNodes] =
    osrdEditoastApi.endpoints.postProjectsByProjectIdStudiesAndStudyIdScenariosScenarioIdMacroNodes.useMutation();

  const dispatch = useAppDispatch();
  const timetableId = scenario.timetable_id;

  async function postRoundTrips(
    roundTrips: RoundTripsFromJson,
    formattedTrainSchedules: TrainScheduleWithTrainId[],
    formattedPacedTrains: PacedTrainWithPacedTrainId[]
  ): Promise<void> {
    if (roundTrips.train_schedules.length > 0) {
      const trainScheduleOneWays: number[] = [];
      const trainScheduleRoundTrips: [number, number][] = [];

      for (const [firstIndex, secondIndex] of roundTrips.train_schedules) {
        if (secondIndex === null) {
          trainScheduleOneWays.push(
            extractEditoastIdFromTrainScheduleId(formattedTrainSchedules[firstIndex].id)
          );
        } else {
          trainScheduleRoundTrips.push([
            extractEditoastIdFromTrainScheduleId(formattedTrainSchedules[firstIndex].id),
            extractEditoastIdFromTrainScheduleId(formattedTrainSchedules[secondIndex].id),
          ]);
        }
      }

      await postTrainScheduleRoundTrips({
        roundTrips: {
          one_ways: trainScheduleOneWays,
          round_trips: trainScheduleRoundTrips,
        },
      }).unwrap();
    }

    if (roundTrips.paced_trains.length > 0) {
      const pacedTrainOneWays: number[] = [];
      const pacedTrainRoundTrips: [number, number][] = [];

      for (const [firstIndex, secondIndex] of roundTrips.paced_trains) {
        if (secondIndex === null) {
          pacedTrainOneWays.push(
            extractEditoastIdFromPacedTrainId(formattedPacedTrains[firstIndex].id)
          );
        } else {
          pacedTrainRoundTrips.push([
            extractEditoastIdFromPacedTrainId(formattedPacedTrains[firstIndex].id),
            extractEditoastIdFromPacedTrainId(formattedPacedTrains[secondIndex].id),
          ]);
        }
      }

      await postPacedTrainRoundTrips({
        roundTrips: {
          one_ways: pacedTrainOneWays,
          round_trips: pacedTrainRoundTrips,
        },
      }).unwrap();
    }
  }

  async function generateTimetableItem() {
    try {
      let trainSchedulePayloads: TrainSchedule[] = [];
      let pacedTrainPayloads: PacedTrain[] = [];

      // JSON import
      if (trainSchedulesJsonData.length > 0 || pacedTrainsJsonData.length > 0) {
        trainSchedulePayloads = trainSchedulesJsonData;
        pacedTrainPayloads = pacedTrainsJsonData;

        // Open data import (only handle trainSchedules)
      } else {
        trainSchedulePayloads = generateTrainSchedulesPayloads(formattedTrainsList);
      }

      let formattedTrainSchedules: TrainScheduleWithTrainId[] = [];

      if (trainSchedulePayloads.length) {
        const trainSchedules = await postTrainSchedule({
          id: timetableId,
          body: trainSchedulePayloads,
        }).unwrap();

        formattedTrainSchedules = trainSchedules.map((trainSchedule) => ({
          ...trainSchedule,
          id: formatEditoastIdToTrainScheduleId(trainSchedule.id),
        }));
      }

      let formattedPacedTrains: PacedTrainWithPacedTrainId[] = [];
      if (pacedTrainPayloads.length) {
        const pacedTrains = await postPacedTrain({
          id: timetableId,
          body: pacedTrainPayloads,
        }).unwrap();

        formattedPacedTrains = pacedTrains.map((pacedTrain) => ({
          ...pacedTrain,
          id: formatEditoastIdToPacedTrainId(pacedTrain.id),
        }));
      }

      upsertTimetableItems([...formattedTrainSchedules, ...formattedPacedTrains]);

      if (roundTripsFromJsonData) {
        await postRoundTrips(roundTripsFromJsonData, formattedTrainSchedules, formattedPacedTrains);
      }

      if (macroNodes && macroNodes.length > 0) {
        await postMacroNodes({
          projectId: scenario.project.id,
          studyId: scenario.study_id,
          scenarioId: scenario.id,
          macroNodeBatchForm: { macro_nodes: macroNodes },
        }).unwrap();
      }

      dispatch(
        setSuccess({
          title: t('success'),
          text: t('status.successfulImport', {
            trainsList,
            count: trainsList.length || [...trainSchedulesJsonData, ...pacedTrainsJsonData].length,
          }),
        })
      );
    } catch (error) {
      dispatch(
        setFailure({
          name: t('failure'),
          message: t('status.invalidTimetableItems', {
            trainsList,
            count: trainsList.length || [...trainSchedulesJsonData, ...pacedTrainsJsonData].length,
          }),
        })
      );
      throw error;
    }
  }

  const computedItemImportLabel = () => {
    const trainScheduleCount = trainsList.length || trainSchedulesJsonData.length;
    const pacedTrainCount = pacedTrainsJsonData.length;

    if (trainScheduleCount > 0 && pacedTrainCount > 0) {
      return t('trainSchedulesAndPacedTrainsFound', { trainScheduleCount, pacedTrainCount });
    }
    if (trainScheduleCount > 0) {
      return t('trainSchedulesFound', { count: trainScheduleCount });
    }
    return t('pacedTrainsFound', { count: pacedTrainCount });
  };

  return trainsList.length > 0 ||
    trainSchedulesJsonData.length > 0 ||
    pacedTrainsJsonData.length > 0 ? (
    <div className="container-fluid mb-2">
      <div className="osrd-config-item-container import-timetable-item-trainlist">
        <div className="import-timetable-item-trainlist-launchbar">
          <span className="import-timetable-item-trainlist-launchbar-nbresults">
            {computedItemImportLabel()}
          </span>
          <button
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
