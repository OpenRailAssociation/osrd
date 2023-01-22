import React, { useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import PropTypes from 'prop-types';
import Loader from 'common/Loader';
import { get } from 'axios';
import nextId from 'react-id-generator';
import TrainDetail from 'applications/opendata/components/TrainDetail';
import OpenDataImportModal from 'applications/opendata/views/OpenDataImportModal';
import { GoRocket } from 'react-icons/go';
import { ModalContext } from 'common/BootstrapSNCF/ModalSNCF/ModalProvider';
import { GRAOU_URL } from '../consts';

function LoadingIfSearching(props) {
  const { t } = useTranslation(['opendata']);
  const { isSearching } = props;
  return (
    <h1 className="text-center text-muted my-5">
      {isSearching ? <Loader position="center" /> : t('noResults')}
    </h1>
  );
}

export default function OpenDataTrainsList(props) {
  const { t } = useTranslation(['opendata']);
  const { openModal } = useContext(ModalContext);
  const { config, rollingStockDB, setMustUpdateTimetable } = props;
  const [trainsList, setTrainList] = useState();
  const [isSearching, setIsSearching] = useState(false);

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
      <div className="osrd-config-item-container opendata-trainlist">
        <div className="opendata-trainlist-launchbar">
          <span className="opendata-trainlist-launchbar-nbresults">
            {trainsList.length} {t('trainsFound')}
          </span>
          <button
            className="btn btn-primary btn-sm ml-auto"
            type="button"
            onClick={() =>
              openModal(
                <OpenDataImportModal
                  rollingStockDB={rollingStockDB}
                  trains={trainsList}
                  setMustUpdateTimetable={setMustUpdateTimetable}
                />
              )
            }
          >
            <GoRocket />
            <span className="ml-3">{t('launchImport')}</span>
          </button>
        </div>
        <div className="opendata-trainlist-results">
          {trainsList.map((train, idx) => (
            <TrainDetail trainData={train} idx={idx} key={nextId()} />
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

OpenDataTrainsList.defaultProps = {
  config: undefined,
};

LoadingIfSearching.propTypes = {
  isSearching: PropTypes.bool.isRequired,
};

OpenDataTrainsList.propTypes = {
  config: PropTypes.object,
  rollingStockDB: PropTypes.array.isRequired,
  setMustUpdateTimetable: PropTypes.func.isRequired,
};
