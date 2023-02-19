import React, { useContext, useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import PropTypes from 'prop-types';
import Loader from 'common/Loader';
import { get } from 'axios';
import ImportTrainScheduleTrainDetail from 'applications/operationalStudies/components/ImportTrainSchedule/ImportTrainScheduleTrainDetail';
import ImportTrainScheduleModal from 'applications/operationalStudies/components/ImportTrainSchedule/ImportTrainScheduleModal';
import { GoRocket } from 'react-icons/go';
import { ModalContext } from 'common/BootstrapSNCF/ModalSNCF/ModalProvider';
import { keyBy } from 'lodash';
import rollingstockOpenData2OSRD from 'applications/operationalStudies/components/ImportTrainSchedule/rollingstock_opendata2osrd.json';
import nextId from 'react-id-generator';
import { GRAOU_URL } from './consts';

function LoadingIfSearching(props) {
  const { t } = useTranslation(['operationalStudies/importTrainSchedule']);
  const { isSearching } = props;
  return (
    <h1 className="text-center text-muted my-5">
      {isSearching ? <Loader position="center" /> : t('noResults')}
    </h1>
  );
}

export default function ImportTrainScheduleTrainsList(props) {
  const { t } = useTranslation(['operationalStudies/importTrainSchedule']);
  const { openModal } = useContext(ModalContext);
  const { config, rollingStockDB } = props;
  const [trainsList, setTrainList] = useState();
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
      console.log(error);
      setIsSearching(false);
    }
  }

  useEffect(() => {
    if (config) {
      getTrains();
    } else {
      setTrainList(undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

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
              rollingStock={rollingStockDict[rollingstockOpenData2OSRD[train.type_em]]}
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

ImportTrainScheduleTrainsList.defaultProps = {
  config: undefined,
};

LoadingIfSearching.propTypes = {
  isSearching: PropTypes.bool.isRequired,
};

ImportTrainScheduleTrainsList.propTypes = {
  config: PropTypes.object,
  rollingStockDB: PropTypes.array.isRequired,
};
