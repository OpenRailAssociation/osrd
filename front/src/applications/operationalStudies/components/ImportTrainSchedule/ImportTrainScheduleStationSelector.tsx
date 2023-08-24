import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import nextId from 'react-id-generator';

import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import { useDebounce } from 'utils/helpers';
import Loader from 'common/Loader';
import StationCard, { ImportStation } from 'common/StationCard';
import { searchGraouStations } from 'common/api/graouApi';

interface ImportTrainScheduleStationSelectorProps {
  id: string;
  term?: string;
  onSelect: (stationName?: ImportStation) => void;
  setTerm: (searchString: string) => void;
}

const ImportTrainScheduleStationSelector = ({
  id,
  onSelect,
  term = '',
  setTerm,
}: ImportTrainScheduleStationSelectorProps) => {
  const { t } = useTranslation(['operationalStudies/importTrainSchedule']);
  const [stationsList, setStationsList] = useState<ImportStation[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const debouncedTerm = useDebounce(term, 500);

  async function searchStations() {
    setIsSearching(true);
    const stations = await searchGraouStations(term);
    if (stations) setStationsList(stations);
    setIsSearching(false);
  }

  useEffect(() => {
    if (debouncedTerm) {
      searchStations();
    } else {
      setStationsList([]);
    }
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
      {stationsList.length > 0 && (
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
};

export default React.memo(ImportTrainScheduleStationSelector);
