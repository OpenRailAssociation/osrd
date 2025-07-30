import { useEffect, useMemo, useState } from 'react';

import { Select, ComboBox } from '@osrd-project/ui-core';
import { useTranslation } from 'react-i18next';

import type { SearchResultItemOperationalPoint } from 'common/api/osrdEditoastApi';
import useSearchOperationalPoint from 'common/Map/Search/useSearchOperationalPoint';
import { updateStdcmPathStep } from 'reducers/osrdconf/stdcmConf';
import type { StdcmPathStep } from 'reducers/osrdconf/types';
import { useAppDispatch } from 'store';
import { normalized } from 'utils/strings';

type StdcmOperationalPointProps = {
  location?: StdcmPathStep['location'];
  pathStepId: string;
  disabled?: boolean;
  onItineraryChange: () => void;
};

type CIOption = StdcmPathStep['location'] & { label: string };
type CHOption = { label: string; id: string; coordinates: [number, number] };

function formatChCode(chCode: string) {
  return chCode === '' ? 'BV' : chCode;
}

const extractChCodes = (searchResults: SearchResultItemOperationalPoint[], selectedCI: CIOption) =>
  searchResults
    .filter((op) => op.name === selectedCI.name)
    .reduce((acc, op) => {
      const newObject = {
        label: formatChCode(op.ch),
        id: op.ch,
        coordinates: op.geographic.coordinates as [number, number],
      };
      const isDuplicate = acc.some((option) => option.label === newObject.label);
      if (!isDuplicate) acc.push(newObject);
      return acc;
    }, [] as CHOption[]);

const StdcmOperationalPoint = ({
  location,
  pathStepId,
  disabled,
  onItineraryChange,
}: StdcmOperationalPointProps) => {
  const { t } = useTranslation('stdcm');
  const dispatch = useAppDispatch();

  const {
    searchTerm,
    setSearchTerm,
    searchResults,
    setSearchResults,
    searchOperationalPointsByTrigram,
  } = useSearchOperationalPoint({
    initialSearchTerm: location?.name,
    initialChCodeFilter: location?.secondary_code,
    isStdcm: true,
  });

  const [chSuggestions, setChSuggestions] = useState<CHOption[]>([]);

  const selectedCi = useMemo(
    () =>
      location
        ? {
            ...location,
            label: [location.trigram, location.name].join(' '),
          }
        : undefined,
    [location]
  );

  const selectedCh = useMemo(
    () =>
      location
        ? {
            label: formatChCode(location.secondary_code),
            id: location.secondary_code,
            coordinates: location.coordinates,
          }
        : undefined,
    [location]
  );

  const ciSuggestions: CIOption[] = useMemo(
    () =>
      // Temporary filter added to show a more restrictive list of suggestions inside the stdcm app.
      searchResults
        .filter(
          (op) =>
            (normalized(op.name).includes(normalized(searchTerm)) ||
              op.trigram.includes(searchTerm.toUpperCase())) &&
            // TODO: Replace this temporary implementation with a permanent solution
            !normalized(op.name).startsWith(normalized('OVERTAKE'))
        )
        .reduce<CIOption[]>((acc, p) => {
          const newObject = {
            label: [p.trigram, p.name].join(' '),
            trigram: p.trigram,
            uic: p.uic,
            secondary_code: p.ch,
            name: p.name,
            coordinates: p.geographic.coordinates as [number, number],
          };
          const isDuplicate = acc.some((pr) => pr.label === newObject.label);
          if (!isDuplicate) acc.push(newObject);
          return acc;
        }, []),
    [searchResults]
  );

  const handleCiSelect = async (selectedSuggestion?: CIOption) => {
    dispatch(updateStdcmPathStep({ id: pathStepId, updates: { location: selectedSuggestion } }));
    onItineraryChange();
    if (selectedSuggestion) {
      const operationalPointParts = await searchOperationalPointsByTrigram(
        selectedSuggestion.trigram
      );
      const newChSuggestions = extractChCodes(operationalPointParts, selectedSuggestion);
      setChSuggestions(newChSuggestions);
    } else {
      setChSuggestions([]);
    }
  };

  const handleChSelect = (selectedChCode?: CHOption) => {
    if (location && selectedChCode) {
      dispatch(
        updateStdcmPathStep({
          id: pathStepId,
          updates: {
            location: {
              ...location,
              secondary_code: selectedChCode.id,
              coordinates: selectedChCode.coordinates,
            },
          },
        })
      );
      onItineraryChange();
    }
  };

  const handleCiInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  const resetSuggestions = () => {
    if (searchTerm !== '' && !location) {
      setSearchResults([]);
      setSearchTerm('');
    }
  };

  useEffect(() => {
    if (location) {
      setSearchTerm(location.name);
      // Clear the list of CH suggestions if the location has changed to avoid showing outated suggestions
      if (!chSuggestions.some((suggestion) => suggestion.label === location.secondary_code)) {
        setChSuggestions([]);
      }
    } else {
      setSearchTerm('');
      setChSuggestions([]);
    }
  }, [location]);

  useEffect(() => {
    // If we start a new query with inputs (ch suggestions will be empty at load),
    // fetch the ch list again for the corresponding CI
    if (chSuggestions.length === 0 && selectedCi && searchResults.length > 0) {
      const updatedChSuggestions = extractChCodes(searchResults, selectedCi);
      setChSuggestions(updatedChSuggestions);
    }
  }, [searchResults, selectedCi, chSuggestions]);

  return (
    <div className="location-line">
      <div className="ci-input">
        <ComboBox
          id={`${pathStepId}-ci`}
          data-testid="operational-point-ci"
          testIdPrefix="suggestions"
          label={t('trainPath.ci')}
          value={selectedCi}
          suggestions={ciSuggestions}
          onChange={handleCiInputChange}
          getSuggestionLabel={(option: CIOption) => option.label}
          onSelectSuggestion={handleCiSelect}
          resetSuggestions={resetSuggestions}
          disabled={disabled}
          autoComplete="off"
          narrow
        />
      </div>
      <div className="ch-input">
        <Select
          label={t('trainPath.ch')}
          id={`${pathStepId}-ch`}
          data-testid="operational-point-ch"
          value={selectedCh}
          onChange={handleChSelect}
          options={chSuggestions}
          getOptionLabel={(option: { id: string; label: string }) => option.label}
          getOptionValue={(option: { id: string; label: string }) => option.id}
          disabled={disabled}
          narrow
        />
      </div>
    </div>
  );
};

export default StdcmOperationalPoint;
