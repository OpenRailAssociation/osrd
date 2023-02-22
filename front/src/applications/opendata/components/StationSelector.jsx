import React, { useEffect, useState, memo } from 'react';
import PropTypes from 'prop-types';
import { get } from 'axios';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import { useDebounce } from 'utils/helpers';
import { useTranslation } from 'react-i18next';
import Loader from 'common/Loader';
import nextId from 'react-id-generator';
import { GRAOU_URL } from '../consts';

export function formatStation(stationData) {
  return (
    <div className="results-station-data">
      <div className="station-data-head">
        <span className="station-data-code">{stationData.code}</span>
        <span className="station-data-name">{stationData.localite}</span>
        <span className="station-data-ch">{stationData.chantier}</span>
      </div>
      <div className="station-data-localization">
        <span className="station-data-city">{stationData.commune}</span>
        <span className="station-data-department">{stationData.departement} / </span>
        <span className="station-data-region">{stationData.region}</span>
        <span className="station-data-uic">{stationData.uic}</span>
      </div>
      {stationData.ligne ? (
        <div className="station-data-footer">
          <span className="station-data-line">{stationData.libelle}</span>
          {stationData.pk ? <span className="station-data-pk">PK {stationData.pk}</span> : null}
          <span className="station-data-line-number">{stationData.ligne}</span>
        </div>
      ) : null}
    </div>
  );
}

function StationSelector(props) {
  const { id, onSelect, term, setTerm } = props;
  const { t } = useTranslation(['opendata']);
  const [stationsList, setStationsList] = useState();
  const [isSearching, setIsSearching] = useState(false);
  const debouncedTerm = useDebounce(term, 500);

  async function getStation() {
    setIsSearching(true);
    try {
      const params = {
        q: 'stations',
        term,
      };
      const result = await get(`${GRAOU_URL}/api/stations.php`, { params });
      setStationsList(result.data);
      setIsSearching(false);
    } catch (error) {
      console.log(error);
      setIsSearching(false);
    }
  }
  useEffect(() => {
    if (debouncedTerm) {
      getStation();
    } else {
      setStationsList(undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedTerm]);

  return (
    <>
      <InputSNCF
        id={id}
        type="text"
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        placeholder={t('inputPlaceholder')}
        sm
        noMargin
        isInvalid={stationsList && stationsList.length === 0}
        unit={stationsList && stationsList.length > 0 ? stationsList.length.toString() : ''}
        focus
        selectAllOnFocus
      />
      {stationsList && stationsList.length > 0 ? (
        <div className="results-stations">
          {stationsList.map((station) => (
            <div role="button" tabIndex={0} onClick={() => onSelect(station)} key={nextId()}>
              {formatStation(station)}
            </div>
          ))}
        </div>
      ) : null}
      {isSearching ? <Loader position="center" /> : null}
    </>
  );
}

StationSelector.defaultProps = {
  term: '',
};

StationSelector.propTypes = {
  onSelect: PropTypes.func.isRequired,
  term: PropTypes.string,
  setTerm: PropTypes.func.isRequired,
  id: PropTypes.string.isRequired,
};

export const MemoStationSelector = memo(StationSelector);
