import React, { useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import Loader from 'common/Loader';
import { get } from 'common/requests';
import ImportTrainScheduleTrainDetail from 'applications/operationalStudies/components/ImportTrainSchedule/ImportTrainScheduleTrainDetail';
import ImportTrainScheduleModal from 'applications/operationalStudies/components/ImportTrainSchedule/ImportTrainScheduleModal';
import { GoRocket } from 'react-icons/go';
import { useModal } from 'common/BootstrapSNCF/ModalSNCF';
import { keyBy } from 'lodash';
import rollingstockOpenData2OSRD from 'applications/operationalStudies/components/ImportTrainSchedule/rollingstock_opendata2osrd.json';
import nextId from 'react-id-generator';
import { TrainSchedule, TrainScheduleImportConfig } from 'applications/operationalStudies/types';
import { LightRollingStock, RollingStock } from 'common/api/osrdEditoastApi';
import { GRAOU_URL } from './consts';

type LoadingProps = {
  isSearching: boolean;
};

function LoadingIfSearching({ isSearching }: LoadingProps) {
  const { t } = useTranslation(['operationalStudies/importTrainSchedule']);
  return (
    <h1 className="text-center text-muted my-5">
      {isSearching ? <Loader position="center" /> : t('noResults')}
    </h1>
  );
}

type ImportTrainScheduleTrainsListProps = {
  config?: TrainScheduleImportConfig;
  trainsList?: TrainSchedule[];
  rollingStockDB: RollingStock[] | LightRollingStock[];
  setTrainList: (trainsSchedules?: TrainSchedule[]) => void;
};

export default function ImportTrainScheduleTrainsList({
  config,
  trainsList,
  rollingStockDB,
  setTrainList,
}: ImportTrainScheduleTrainsListProps) {
  const { t } = useTranslation(['operationalStudies/importTrainSchedule']);
  const { openModal } = useModal();
  const [isSearching, setIsSearching] = useState(false);

  const rollingStockDict = useMemo(
    () => keyBy(rollingStockDB, (rollingStock) => rollingStock.name),
    [rollingStockDB]
  );

  async function getTrains() {
    setTrainList(undefined);
    setIsSearching(true);
    try {
      const params = {
        q: 'trains',
        config,
      };
      const result = await get(`${GRAOU_URL}/api/trainschedules.php`, { params });
      setTrainList(result.data);
      setIsSearching(false);
    } catch (error) {
      console.error(error);
      setIsSearching(false);
    }
  }

  useEffect(() => {
    if (config) {
      getTrains();
    } else {
      setTrainList(undefined);
    }
  }, [config]);

  // if (!config) return null;

  return trainsList && trainsList.length > 0 ? (
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
        <LoadingIfSearching isSearching={isSearching} />
      </div>
    </div>
  );
}
