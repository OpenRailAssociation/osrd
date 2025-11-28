import { useEffect, useMemo, useState } from 'react';

import { Select, ComboBox } from '@osrd-project/ui-core';
import { useTranslation } from 'react-i18next';

import type { SearchResultItemOperationalPoint } from 'common/api/osrdEditoastApi';
import useSearchOperationalPoint from 'common/Map/Search/useSearchOperationalPoint';
import { updateStdcmPathStep } from 'reducers/osrdconf/stdcmConf';
import type { StdcmPathStep } from 'reducers/osrdconf/types';
import { useAppDispatch } from 'store';
import { normalized } from 'utils/strings';

type StdcmOp = NonNullable<StdcmPathStep['operationalPoint']>;

type StdcmOperationalPointProps = {
  operationalPoint?: StdcmOp;
  pathStepId: string;
  disabled?: boolean;
  onItineraryChange: () => void;
};

function formatChCode(chCode: string) {
  return chCode === '' ? 'BV' : chCode;
}

const stdcmOpFromSearchResult = (searchResult: SearchResultItemOperationalPoint): StdcmOp => ({
  id: searchResult.obj_id,
  uic: searchResult.uic,
  trigram: searchResult.trigram,
  secondaryCode: searchResult.ch,
  name: searchResult.name,
  coordinates: searchResult.geographic.coordinates as [number, number],
});

const extractChCodes = (searchResults: SearchResultItemOperationalPoint[], selectedCI: StdcmOp) =>
  searchResults
    .filter((op) => op.name === selectedCI.name)
    .reduce<StdcmOp[]>((acc, op) => {
      const newObject = stdcmOpFromSearchResult(op);
      const isDuplicate = acc.some((option) => option.secondaryCode === newObject.secondaryCode);
      if (!isDuplicate) acc.push(newObject);
      return acc;
    }, []);

const StdcmOperationalPoint = ({
  operationalPoint,
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
    initialSearchTerm: operationalPoint?.name,
    initialChCodeFilter: operationalPoint?.secondaryCode,
    isStdcm: true,
  });

  const [chSuggestions, setChSuggestions] = useState<StdcmOp[]>([]);

  const ciSuggestions: StdcmOp[] = useMemo(
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
        .reduce<StdcmOp[]>((acc, p) => {
          const newObject = stdcmOpFromSearchResult(p);
          const isDuplicate = acc.some(
            (pr) => pr.name === newObject.name && pr.trigram === newObject.trigram
          );
          if (!isDuplicate) acc.push(newObject);
          return acc;
        }, []),
    [searchResults]
  );

  const handleCiSelect = async (selectedSuggestion?: StdcmOp) => {
    dispatch(
      updateStdcmPathStep({ id: pathStepId, updates: { operationalPoint: selectedSuggestion } })
    );
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

  const handleChSelect = (selectedChCode?: StdcmOp) => {
    if (selectedChCode) {
      dispatch(
        updateStdcmPathStep({
          id: pathStepId,
          updates: {
            operationalPoint: selectedChCode,
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
    if (searchTerm !== '' && !operationalPoint) {
      setSearchResults([]);
      setSearchTerm('');
    }
  };

  useEffect(() => {
    if (operationalPoint) {
      setSearchTerm(operationalPoint.name);
      // Clear the list of CH suggestions if the location has changed to avoid showing outated suggestions
      if (
        !chSuggestions.some(
          (suggestion) => suggestion.secondaryCode === operationalPoint.secondaryCode
        )
      ) {
        setChSuggestions([]);
      }
    } else {
      setSearchTerm('');
      setChSuggestions([]);
    }
  }, [operationalPoint]);

  useEffect(() => {
    // If we start a new query with inputs (ch suggestions will be empty at load),
    // fetch the ch list again for the corresponding CI
    if (chSuggestions.length === 0 && operationalPoint && searchResults.length > 0) {
      const updatedChSuggestions = extractChCodes(searchResults, operationalPoint);
      setChSuggestions(updatedChSuggestions);
    }
  }, [searchResults, operationalPoint, chSuggestions]);

  return (
    <div className="location-line">
      <div className="ci-input">
        <ComboBox
          id={`${pathStepId}-ci`}
          data-testid="operational-point-ci"
          testIdPrefix="suggestions"
          label={t('trainPath.ci')}
          value={operationalPoint}
          suggestions={ciSuggestions}
          onChange={handleCiInputChange}
          getSuggestionLabel={(option) => [option.trigram, option.name].join(' ')}
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
          value={operationalPoint}
          onChange={handleChSelect}
          options={chSuggestions}
          getOptionLabel={(option) => formatChCode(option.secondaryCode)}
          getOptionValue={(option) => option.secondaryCode}
          disabled={disabled}
          narrow
        />
      </div>
    </div>
  );
};

export default StdcmOperationalPoint;
