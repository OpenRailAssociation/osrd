import React, { useEffect, useState } from 'react';

import { useTranslation } from 'react-i18next';

import { type GraouStation, searchGraouStations } from 'common/api/graouApi';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import { Loader } from 'common/Loaders';
import StationCard from 'common/StationCard';
import { useDebounce } from 'utils/helpers';

type ImportTimetableItemStationSelectorProps = {
  id: string;
  term?: string;
  onSelect: (station?: GraouStation) => void;
  setTerm: (searchString: string) => void;
};

const ImportTimetableItemStationSelector = ({
  id,
  onSelect,
  term = '',
  setTerm,
}: ImportTimetableItemStationSelectorProps) => {
  const { t } = useTranslation('operational-studies', { keyPrefix: 'importTrains' });
  const [stationsList, setStationsList] = useState<GraouStation[]>([]);
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
            <div
              role="button"
              aria-label={t('selectStation')}
              tabIndex={0}
              onClick={() => onSelect(station)}
              key={`${station.name}-${station.uic}-${station.trigram}`}
            >
              <StationCard station={station} fixedHeight />
            </div>
          ))}
        </div>
      )}
      {isSearching && <Loader position="center" />}
    </>
  );
};

export default React.memo(ImportTimetableItemStationSelector);
