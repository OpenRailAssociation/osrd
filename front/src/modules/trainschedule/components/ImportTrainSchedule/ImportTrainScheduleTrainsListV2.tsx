import React, { useMemo } from 'react';

import { Rocket } from '@osrd-project/ui-icons';
import type { TFunction } from 'i18next';
import { keyBy } from 'lodash';
import { useTranslation } from 'react-i18next';

import type { TrainScheduleV2 } from 'applications/operationalStudies/types';
import { osrdEditoastApi, type LightRollingStockWithLiveries } from 'common/api/osrdEditoastApi';
import { Loader } from 'common/Loaders';
// eslint-disable-next-line import/no-cycle
import { ImportTrainScheduleTrainDetail } from 'modules/trainschedule/components/ImportTrainSchedule';
import rollingstockOpenData2OSRD from 'modules/trainschedule/components/ImportTrainSchedule/rollingstock_opendata2osrd.json';
import { setFailure, setSuccess } from 'reducers/main';
import { useAppDispatch } from 'store';

import { generateV2TrainSchedulesPayloads } from './generateTrainSchedulesPayloads';

function LoadingIfSearching({ isLoading, t }: { isLoading: boolean; t: TFunction }) {
  return (
    <h1 className="text-center text-muted my-5">
      {isLoading ? <Loader position="center" /> : `${t('noResults')}`}
    </h1>
  );
}

type ImportTrainScheduleTrainsListProps = {
  trainsList: TrainScheduleV2[];
  rollingStocks: LightRollingStockWithLiveries[];
  isLoading: boolean;
  timetableId: number;
};

const ImportTrainScheduleTrainsListV2 = ({
  trainsList,
  rollingStocks,
  isLoading,
  timetableId,
}: ImportTrainScheduleTrainsListProps) => {
  const { t } = useTranslation(['operationalStudies/importTrainSchedule']);

  const rollingStockDict = useMemo(
    () => keyBy(rollingStocks, (rollingStock) => rollingStock.name),
    [rollingStocks]
  );

  const { refetch: refetchTimetable } =
    osrdEditoastApi.endpoints.getV2TimetableById.useQuerySubscription({ id: timetableId });
  const [postTrainSchedule] = osrdEditoastApi.endpoints.postV2TrainSchedule.useMutation();

  const dispatch = useAppDispatch();

  async function generateV2TrainSchedules() {
    const payloads = generateV2TrainSchedulesPayloads(trainsList, timetableId);

    const trainsCount = payloads.length;
    let successfulTrainsCount = 0;
    let errorsNb = 0;
    // eslint-disable-next-line no-restricted-syntax
    for await (const payload of payloads) {
      try {
        await postTrainSchedule({ body: [payload] }).unwrap();
        successfulTrainsCount += 1;
      } catch (error) {
        errorsNb += 1;
      }
    }
    if (errorsNb > 0) {
      dispatch(
        setFailure({
          name: t('failure'),
          message: t('status.calculatingTrainScheduleCompleteFailure', {
            trainsCount,
            errorsNb,
            count: trainsCount - errorsNb,
          }),
        })
      );
      refetchTimetable();
    } else {
      dispatch(
        setSuccess({
          title: t('success'),
          text: t('status.calculatingTrainScheduleCompleteAllSuccess', {
            successfulTrainsCount,
            count: successfulTrainsCount,
          }),
        })
      );
    }
  }

  return trainsList.length > 0 ? (
    <div className="container-fluid mb-2">
      <div className="osrd-config-item-container import-train-schedule-trainlist">
        <div className="import-train-schedule-trainlist-launchbar">
          <span className="import-train-schedule-trainlist-launchbar-nbresults">
            {trainsList.length} {t('trainsFound')}
          </span>
          <button
            className="btn btn-primary btn-sm ml-auto"
            type="button"
            onClick={generateV2TrainSchedules}
          >
            <Rocket />
            <span className="ml-3">{t('launchImport')}</span>
          </button>
        </div>
        <div className="import-train-schedule-trainlist-results">
          {trainsList.map((train, idx) => (
            <ImportTrainScheduleTrainDetail
              trainData={train}
              idx={idx}
              key={train.trainNumber}
              rollingStock={
                rollingStockDict[
                  rollingstockOpenData2OSRD[
                    train.rollingStock as keyof typeof rollingstockOpenData2OSRD
                  ]
                ]
              }
            />
          ))}
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

export default ImportTrainScheduleTrainsListV2;
