import React, { useMemo } from 'react';

import { Rocket } from '@osrd-project/ui-icons';
import type { TFunction } from 'i18next';
import { keyBy } from 'lodash';
import { useTranslation } from 'react-i18next';
import nextId from 'react-id-generator';

import type { TrainSchedule } from 'applications/operationalStudies/types';
import type { LightRollingStockWithLiveries } from 'common/api/osrdEditoastApi';
import { useModal } from 'common/BootstrapSNCF/ModalSNCF';
import { Loader } from 'common/Loaders';
// eslint-disable-next-line import/no-cycle
import { ImportTrainScheduleTrainDetail } from 'modules/trainschedule/components/ImportTrainSchedule';
import rollingstockOpenData2OSRD from 'modules/trainschedule/components/ImportTrainSchedule/rollingstock_opendata2osrd.json';

import ImportTrainScheduleModalV2 from './ImportTrainScheduleModalV2';

function LoadingIfSearching({ isLoading, t }: { isLoading: boolean; t: TFunction }) {
  return (
    <h1 className="text-center text-muted my-5">
      {isLoading ? <Loader position="center" /> : `${t('noResults')}`}
    </h1>
  );
}

type ImportTrainScheduleTrainsListProps = {
  trainsList: TrainSchedule[];
  rollingStocks: LightRollingStockWithLiveries[];
  infraId: number;
  isLoading: boolean;
  timetableId: number;
};

const ImportTrainScheduleTrainsListV2 = ({
  trainsList,
  rollingStocks,
  infraId,
  isLoading,
  timetableId,
}: ImportTrainScheduleTrainsListProps) => {
  const { t } = useTranslation(['operationalStudies/importTrainSchedule']);
  const { openModal } = useModal();

  const rollingStockDict = useMemo(
    () => keyBy(rollingStocks, (rollingStock) => rollingStock.name),
    [rollingStocks]
  );

  return trainsList.length > 0 ? (
    <div className="osrd-config-item mb-2">
      <div className="osrd-config-item-container import-train-schedule-trainlist">
        <div className="import-train-schedule-trainlist-launchbar">
          <span className="import-train-schedule-trainlist-launchbar-nbresults">
            {trainsList.length} {t('trainsFound')}
          </span>
          <button
            className="btn btn-primary btn-sm ml-auto"
            type="button"
            onClick={() =>
              openModal(
                <ImportTrainScheduleModalV2
                  infraId={infraId}
                  rollingStocks={rollingStocks}
                  trains={trainsList}
                  timetableId={timetableId}
                />
              )
            }
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
              key={nextId()}
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
    <div className="osrd-config-item mb-2">
      <div className="osrd-config-item-container">
        <LoadingIfSearching isLoading={isLoading} t={t} />
      </div>
    </div>
  );
};

export default ImportTrainScheduleTrainsListV2;
