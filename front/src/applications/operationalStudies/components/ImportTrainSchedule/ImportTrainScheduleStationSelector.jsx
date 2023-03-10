import React, { useEffect, useState, memo } from 'react';
import PropTypes from 'prop-types';
import { get } from 'axios';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import { useDebounce } from 'utils/helpers';
import { useTranslation } from 'react-i18next';
import Loader from 'common/Loader';
import nextId from 'react-id-generator';
import StationCard from 'common/StationCard';
import { GRAOU_URL } from './consts';

function ImportTrainScheduleStationSelector(props) {
  const { id, onSelect, term, setTerm } = props;
  const { t } = useTranslation(['operationalStudies/importTrainSchedule']);
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
      {stationsList && stationsList.length > 0 && (
        <div className="results-stations">
          {stationsList.map((station) => (
            <div role="button" tabIndex={0} onClick={() => onSelect(station)} key={nextId()}>
              <StationCard station={station} fixedHeight />
            </div>
          ))}
        </div>
      )}
      {isSearching && <Loader position="center" />}
    </>
  );
}

ImportTrainScheduleStationSelector.defaultProps = {
  term: '',
};

ImportTrainScheduleStationSelector.propTypes = {
  onSelect: PropTypes.func.isRequired,
  term: PropTypes.string,
  setTerm: PropTypes.func.isRequired,
  id: PropTypes.string.isRequired,
};

const MemoStationSelector = memo(ImportTrainScheduleStationSelector);
export default MemoStationSelector;
