import { useMemo } from 'react';

import { Rocket } from '@osrd-project/ui-icons';
import type { TFunction } from 'i18next';
import { keyBy } from 'lodash';
import { useTranslation } from 'react-i18next';

import type { ImportedTrainSchedule } from 'applications/operationalStudies/types';
import {
  osrdEditoastApi,
  type LightRollingStockWithLiveries,
  type TrainScheduleBase,
  type TrainScheduleResult,
} from 'common/api/osrdEditoastApi';
import { Loader } from 'common/Loaders';
import { ImportTrainScheduleTrainDetail } from 'modules/trainschedule/components/ImportTrainSchedule';
import rollingstockOpenData2OSRD from 'modules/trainschedule/components/ImportTrainSchedule/rollingstock_opendata2osrd.json';
import { notifyFailure, notifySuccess } from 'reducers/main';
import { useAppDispatch } from 'store';

import { generateTrainSchedulesPayloads } from './generateTrainSchedulesPayloads';
import type { RollingstockOpenData2OSRDKeys } from './types';

function LoadingIfSearching({ isLoading, t }: { isLoading: boolean; t: TFunction }) {
  return (
    <h1 className="text-center text-muted my-5">
      {isLoading ? <Loader position="center" /> : `${t('noResults')}`}
    </h1>
  );
}

type ImportTrainScheduleTrainsListProps = {
  trainsList: ImportedTrainSchedule[];
  rollingStocks: LightRollingStockWithLiveries[];
  isLoading: boolean;
  timetableId: number;
  trainsJsonData: TrainScheduleBase[];
  upsertTrainSchedules: (trainSchedules: TrainScheduleResult[]) => void;
};

const ImportTrainScheduleTrainsList = ({
  trainsList,
  rollingStocks,
  isLoading,
  timetableId,
  trainsJsonData,
  upsertTrainSchedules,
}: ImportTrainScheduleTrainsListProps) => {
  const { t } = useTranslation(['operationalStudies/importTrainSchedule']);

  const rollingStockDict = useMemo(
    () => keyBy(rollingStocks, (rollingStock) => rollingStock.name),
    [rollingStocks]
  );

  // Format the trains list to match the train names provided by the backend
  const formattedTrainsList = useMemo(
    () =>
      trainsList.map(({ rollingStock, ...train }) => {
        const validTrainName =
          rollingstockOpenData2OSRD[rollingStock as RollingstockOpenData2OSRDKeys];
        return { ...train, rollingStock: validTrainName };
      }),
    [trainsList]
  );

  const [postTrainSchedule] =
    osrdEditoastApi.endpoints.postTimetableByIdTrainSchedule.useMutation();

  const dispatch = useAppDispatch();

  async function generateTrainSchedules() {
    try {
      const payloads =
        trainsJsonData.length > 0
          ? trainsJsonData
          : generateTrainSchedulesPayloads(formattedTrainsList);

      const trainSchedules = await postTrainSchedule({ id: timetableId, body: payloads }).unwrap();
      upsertTrainSchedules(trainSchedules);
      dispatch(
        notifySuccess({
          title: t('success'),
          text: t('status.calculatingTrainScheduleCompleteAllSuccess', {
            trainsList,
            count: trainsList.length,
          }),
        })
      );
    } catch (error) {
      dispatch(
        notifyFailure({
          name: t('failure'),
          message: t('status.calculatingTrainScheduleCompleteAllFailure', {
            trainsList,
            count: trainsList.length,
          }),
        })
      );
      throw error;
    }
  }

  return trainsList.length > 0 || trainsJsonData.length > 0 ? (
    <div className="container-fluid mb-2">
      <div className="osrd-config-item-container import-train-schedule-trainlist">
        <div className="import-train-schedule-trainlist-launchbar">
          <span className="import-train-schedule-trainlist-launchbar-nbresults">
            {trainsList.length > 0 ? trainsList.length : trainsJsonData.length} {t('trainsFound')}
          </span>
          <button
            className="btn btn-primary btn-sm ml-auto"
            type="button"
            onClick={() => generateTrainSchedules()}
          >
            <Rocket />
            <span className="ml-3">{t('launchImport')}</span>
          </button>
        </div>
        {trainsList.length > 0 && (
          <div className="import-train-schedule-trainlist-results">
            {trainsList.map((train, idx) => (
              <ImportTrainScheduleTrainDetail
                trainData={train}
                idx={idx}
                key={train.trainNumber}
                rollingStock={
                  rollingStockDict[
                    rollingstockOpenData2OSRD[train.rollingStock as RollingstockOpenData2OSRDKeys]
                  ]
                }
              />
            ))}
          </div>
        )}
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

export default ImportTrainScheduleTrainsList;
