import { useMemo } from 'react';

import { Rocket } from '@osrd-project/ui-icons';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';

import type {
  ImportedTrainSchedule,
  TimetableJsonPayload,
} from 'applications/operationalStudies/types';
import {
  osrdEditoastApi,
  type PacedTrain,
  type TrainScheduleBase,
} from 'common/api/osrdEditoastApi';
import { Loader } from 'common/Loaders';
import rollingstockOpenData2OSRD from 'modules/trainschedule/components/ImportTimetableItem/rollingstock_opendata2osrd.json';
import { setFailure, setSuccess } from 'reducers/main';
import type {
  PacedTrainResponseWithPacedTrainId,
  TimetableItemWithTimetableId,
  TrainScheduleResponseWithTrainId,
} from 'reducers/osrdconf/types';
import { useAppDispatch } from 'store';
import {
  formatEditoastTrainIdToPacedTrainId,
  formatEditoastTrainIdToTrainScheduleId,
} from 'utils/trainId';

import { generateTrainSchedulesPayloads } from './generateTrainSchedulesPayloads';
import { findValidTrainNameKey } from '../ManageTrainSchedule/helpers/trainNameHelper';

function LoadingIfSearching({ isLoading, t }: { isLoading: boolean; t: TFunction }) {
  return (
    <h1 className="text-center text-muted my-5">
      {isLoading ? <Loader position="center" /> : `${t('noResults')}`}
    </h1>
  );
}

type ImportTimetableItemTrainsListProps = {
  trainsList: ImportedTrainSchedule[];
  isLoading: boolean;
  timetableId: number;
  trainsJsonData: TimetableJsonPayload;
  trainsXmlData: ImportedTrainSchedule[];
  upsertTimetableItems: (timetableItems: TimetableItemWithTimetableId[]) => void;
  dtoImport: () => void;
};

const ImportTimetableItemTrainsList = ({
  trainsList,
  isLoading,
  timetableId,
  trainsJsonData,
  trainsXmlData,
  upsertTimetableItems,
  dtoImport,
}: ImportTimetableItemTrainsListProps) => {
  const { t } = useTranslation(['operationalStudies/importTimetableItem', 'translation']);

  const { train_schedules: trainSchedulesJsonData, paced_trains: pacedTrainsJsonData } =
    trainsJsonData;

  const formattedTrainsList = useMemo(
    () =>
      trainsList.map(({ rollingStock, ...train }) => {
        if (!rollingStock) {
          return { ...train, rollingStock: '' };
        }

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

  const dispatch = useAppDispatch();

  async function generateTimetableItem() {
    try {
      let trainSchedulePayloads: TrainScheduleBase[] = [];
      let pacedTrainPayloads: PacedTrain[] = [];

      // Viriato import (TODO Paced train : handle viriato imports for paced trains)
      if (trainsXmlData.length > 0) {
        trainSchedulePayloads = generateTrainSchedulesPayloads(trainsXmlData, true);

        // JSON import
      } else if (trainSchedulesJsonData.length > 0 || pacedTrainsJsonData.length > 0) {
        trainSchedulePayloads = trainSchedulesJsonData;
        pacedTrainPayloads = pacedTrainsJsonData;

        // Open data import (only handle trainSchedules)
      } else {
        trainSchedulePayloads = generateTrainSchedulesPayloads(formattedTrainsList, false);
      }

      let formattedTrainSchedules: TrainScheduleResponseWithTrainId[] = [];

      if (trainSchedulePayloads.length) {
        const trainSchedules = await postTrainSchedule({
          id: timetableId,
          body: trainSchedulePayloads,
        }).unwrap();

        formattedTrainSchedules = trainSchedules.map((trainSchedule) => ({
          ...trainSchedule,
          id: formatEditoastTrainIdToTrainScheduleId(trainSchedule.id),
        }));
      }

      let formattedPacedTrains: PacedTrainResponseWithPacedTrainId[] = [];
      if (pacedTrainPayloads.length) {
        const pacedTrains = await postPacedTrain({
          id: timetableId,
          body: pacedTrainPayloads,
        }).unwrap();

        formattedPacedTrains = pacedTrains.map((pacedTrain) => ({
          ...pacedTrain,
          id: formatEditoastTrainIdToPacedTrainId(pacedTrain.id),
        }));
      }

      upsertTimetableItems([...formattedTrainSchedules, ...formattedPacedTrains]);
      dtoImport();
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
          message: t('status.invalidTrainSchedules', {
            trainsList,
            count: trainsList.length || [...trainSchedulesJsonData, ...pacedTrainsJsonData].length,
          }),
        })
      );
      throw error;
    }
  }

  const computedItemImportLabel = () => {
    if (!trainSchedulesJsonData.length && !trainsList.length && !!pacedTrainsJsonData.length) {
      return t('pacedTrainsFound', {
        count: pacedTrainsJsonData.length,
        pacedTrainsFound: pacedTrainsJsonData.length,
      });
    }

    return t('itemsFound', {
      count: trainsList.length || [...trainSchedulesJsonData, ...pacedTrainsJsonData].length,
      pacedTrainsFound: pacedTrainsJsonData.length,
      trainsFound: trainsList.length || trainSchedulesJsonData.length,
      and:
        !!trainSchedulesJsonData.length && !!pacedTrainsJsonData.length
          ? t('translation:common.and')
          : '',
    });
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
