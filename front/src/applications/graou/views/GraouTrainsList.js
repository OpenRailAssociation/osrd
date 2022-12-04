import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import PropTypes from 'prop-types';
import { setFailure } from 'reducers/main';
import { useDispatch } from 'react-redux';
import Loader from 'common/Loader';
import { get } from 'axios';
import nextId from 'react-id-generator';
import TrainDetail from 'applications/graou/components/TrainDetail';
import GraouImportModal from 'applications/graou/views/GraouImportModal';
import { GRAOU_URL } from '../consts';
import { GoRocket } from 'react-icons/go';

function LoadingIfSearching(props) {
  const { t } = useTranslation(['graou']);
  const { isSearching } = props;
  return (
    <h1 className="text-center text-muted my-5">
      {isSearching ? <Loader position="center" /> : t('noResults')}
    </h1>
  );
}

export default function GraouTrainsList(props) {
  const { t } = useTranslation(['graou']);
  const { config, rollingStockDB } = props;
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
      <div className="osrd-config-item-container graou-trainlist">
        <div className="graou-trainlist-launchbar">
          <span className="graou-trainlist-launchbar-nbresults">
            {trainsList.length} {t('trainsFound')}
          </span>
          <button
            className="btn btn-primary btn-sm ml-auto"
            type="button"
            data-toggle="modal"
            data-target="#GraouImportModal"
          >
            <GoRocket />
            <span className="ml-3">{t('launchImport')}</span>
          </button>
        </div>
        <div className="graou-trainlist-results">
          {trainsList.map((train, idx) => (
            <TrainDetail trainData={train} idx={idx} key={nextId()} />
          ))}
        </div>
      </div>
      <GraouImportModal rollingStockDB={rollingStockDB} trains={trainsList} />
    </div>
  ) : (
    <div className="osrd-config-item mb-2">
      <div className="osrd-config-item-container">
        <LoadingIfSearching isSearching={isSearching} />
      </div>
    </div>
  );
}

GraouTrainsList.defaultProps = {
  config: undefined,
};

LoadingIfSearching.propTypes = {
  isSearching: PropTypes.bool.isRequired,
};

GraouTrainsList.propTypes = {
  config: PropTypes.object,
  rollingStockDB: PropTypes.array.isRequired,
};
