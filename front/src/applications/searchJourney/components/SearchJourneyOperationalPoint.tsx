import { useEffect, useMemo, useState } from 'react';

import { Select, ComboBox } from '@osrd-project/ui-core';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import type { SearchResultItemOperationalPoint } from 'common/api/osrdEditoastApi';
import useSearchOperationalPoint from 'common/Map/Search/useSearchOperationalPoint';
import {
  updateSearchJourneyDestination,
  updateSearchJourneyOrigin,
  type SearchJourneyOperationalPoint as SearchJourneyOp,
} from 'reducers/searchJourney';
import { getSearchJourneyInfraId } from 'reducers/searchJourney/selectors';
import { useAppDispatch } from 'store';
import { normalized } from 'utils/strings';

const formatSecondaryCode = (secondaryCode?: string | null) => secondaryCode || 'BV';

const searchJourneyOpFromSearchResult = (
  searchResult: SearchResultItemOperationalPoint
): SearchJourneyOp => {
  if (searchResult.uic === null || searchResult.uic === undefined)
    throw new Error(`Operational point ${searchResult.obj_id} has no UIC`);
  return {
    id: searchResult.obj_id,
    uic: searchResult.uic,
    mainCode: searchResult.main_code,
    secondaryCode: searchResult.secondary_code,
    name: searchResult.name,
    coordinates: searchResult.geographic!.coordinates as [number, number],
  };
};

const extractChCodes = (
  searchResults: SearchResultItemOperationalPoint[],
  selectedCI: SearchJourneyOp
) =>
  searchResults
    .filter((op) => op.name === selectedCI.name)
    .reduce<SearchJourneyOp[]>((acc, op) => {
      const newObject = searchJourneyOpFromSearchResult(op);
      const isDuplicate = acc.some((option) => option.secondaryCode === newObject.secondaryCode);
      if (!isDuplicate) acc.push(newObject);
      return acc;
    }, []);

type SearchJourneyOperationalPointProps = {
  /** Which field of the searchJourney store this instance edits. */
  field: 'origin' | 'destination';
  operationalPoint?: SearchJourneyOp;
  disabled?: boolean;
};

/**
 * Origin/destination operational point picker for the search journey form.
 *
 * This is a sibling of `StdcmOperationalPoint`, not a reuse of it: unlike STDCM's
 * path steps, searchJourney only has two fixed slots (origin/destination) stored
 * flat in `searchJourneySlice`, so the dispatch/props shape differs.
 */
const SearchJourneyOperationalPoint = ({
  field,
  operationalPoint,
  disabled,
}: SearchJourneyOperationalPointProps) => {
  const { t } = useTranslation('search-journey');
  const dispatch = useAppDispatch();
  const infraId = useSelector(getSearchJourneyInfraId);

  const { searchTerm, setSearchTerm, searchResults, searchOperationalPointsByMainCode } =
    useSearchOperationalPoint({
      infraId,
      initialSearchTerm: operationalPoint?.name,
      initialSecondaryCodeFilter: operationalPoint?.secondaryCode,
    });

  const [chSuggestions, setChSuggestions] = useState<SearchJourneyOp[]>([]);

  const updateOperationalPoint =
    field === 'origin' ? updateSearchJourneyOrigin : updateSearchJourneyDestination;

  const ciSuggestions: SearchJourneyOp[] = useMemo(
    () =>
      searchResults
        .filter(
          (op) =>
            normalized(op.name).includes(normalized(searchTerm)) ||
            op.main_code.includes(searchTerm.toUpperCase())
        )
        .reduce<SearchJourneyOp[]>((acc, p) => {
          const newObject = searchJourneyOpFromSearchResult(p);
          const isDuplicate = acc.some(
            (pr) => pr.name === newObject.name && pr.mainCode === newObject.mainCode
          );
          if (!isDuplicate) acc.push(newObject);
          return acc;
        }, []),
    [searchResults, searchTerm]
  );

  const handleCiSelect = async (selectedSuggestion?: SearchJourneyOp) => {
    dispatch(updateOperationalPoint(selectedSuggestion));
    if (!selectedSuggestion) {
      setChSuggestions([]);
      return;
    }
    const operationalPointParts = await searchOperationalPointsByMainCode(
      selectedSuggestion.mainCode
    );
    setChSuggestions(extractChCodes(operationalPointParts, selectedSuggestion));
  };

  const handleChSelect = (selectedChCode?: SearchJourneyOp) => {
    if (selectedChCode) {
      dispatch(updateOperationalPoint(selectedChCode));
    }
  };

  const handleCiInputChange = (inputValue: string) => {
    setSearchTerm(inputValue);
  };

  const resetSuggestions = () => {
    if (searchTerm !== '' && !operationalPoint) {
      setSearchTerm('');
    }
  };

  useEffect(() => {
    if (operationalPoint) {
      setSearchTerm(operationalPoint.name);
      // Clear the list of CH suggestions if the location has changed to avoid showing outdated suggestions
      if (
        operationalPoint.secondaryCode &&
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
      setChSuggestions(extractChCodes(searchResults, operationalPoint));
    }
  }, [searchResults, operationalPoint, chSuggestions]);

  return (
    <div className="location-line">
      <div className="ci-input">
        <ComboBox
          id={`${field}-ci`}
          data-testid={`${field}-operational-point-ci`}
          testIdPrefix="suggestions"
          label={t('trainPath.ci')}
          value={operationalPoint}
          suggestions={ciSuggestions}
          onChange={handleCiInputChange}
          getSuggestionLabel={(option) => [option.mainCode, option.name].join(' ')}
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
          id={`${field}-ch`}
          data-testid={`${field}-operational-point-secondary-code`}
          value={operationalPoint?.secondaryCode ? operationalPoint : undefined}
          onChange={handleChSelect}
          options={chSuggestions}
          getOptionLabel={(option) => formatSecondaryCode(option.secondaryCode)}
          getOptionValue={(option) => option.secondaryCode ?? ''}
          disabled={disabled}
          narrow
        />
      </div>
    </div>
  );
};

export default SearchJourneyOperationalPoint;
