import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import Loader from 'common/Loader';
import ImportTrainScheduleTrainDetail from 'applications/operationalStudies/components/ImportTrainSchedule/ImportTrainScheduleTrainDetail';
import ImportTrainScheduleModal from 'applications/operationalStudies/components/ImportTrainSchedule/ImportTrainScheduleModal';
import { GoRocket } from 'react-icons/go';
import { useModal } from 'common/BootstrapSNCF/ModalSNCF';
import { keyBy } from 'lodash';
import rollingstockOpenData2OSRD from 'applications/operationalStudies/components/ImportTrainSchedule/rollingstock_opendata2osrd.json';
import nextId from 'react-id-generator';
import { TrainSchedule } from 'applications/operationalStudies/types';
import { LightRollingStock, RollingStock } from 'common/api/osrdEditoastApi';
import { TFunction } from 'i18next';

function LoadingIfSearching({ isLoading, t }: { isLoading: boolean; t: TFunction }) {
  return (
    <h1 className="text-center text-muted my-5">
      {isLoading ? <Loader position="center" /> : `${t('noResults')}`}
    </h1>
  );
}

type ImportTrainScheduleTrainsListProps = {
  trainsList: TrainSchedule[];
  rollingStockDB: RollingStock[] | LightRollingStock[];
  isLoading: boolean;
};

export default function ImportTrainScheduleTrainsList({
  trainsList,
  rollingStockDB,
  isLoading,
}: ImportTrainScheduleTrainsListProps) {
  const { t } = useTranslation(['operationalStudies/importTrainSchedule']);
  const { openModal } = useModal();

  const rollingStockDict = useMemo(
    () => keyBy(rollingStockDB, (rollingStock) => rollingStock.name),
    [rollingStockDB]
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
                <ImportTrainScheduleModal rollingStockDB={rollingStockDB} trains={trainsList} />
              )
            }
          >
            <GoRocket />
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
}
