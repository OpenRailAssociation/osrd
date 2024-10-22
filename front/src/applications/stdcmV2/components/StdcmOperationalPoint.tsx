import { useEffect, useMemo } from 'react';

import { Select, ComboBox } from '@osrd-project/ui-core';
import { useTranslation } from 'react-i18next';

import type { SearchResultItemOperationalPoint } from 'common/api/osrdEditoastApi';
import useSearchOperationalPoint from 'common/Map/Search/useSearchOperationalPoint';
import type { StdcmPathStep } from 'reducers/osrdconf/types';
import { normalized } from 'utils/strings';
import { createFixedSelectOptions } from 'utils/uiCoreHelpers';

type StdcmOperationalPointProps = {
  pathStepId: string;
  updatePathStepLocation: (location: StdcmPathStep['location']) => void;
  pathStepLocation?: {
    secondaryCode?: string | null;
    uic: number;
    name: string;
  };
  disabled?: boolean;
};

type Option = { label: string; value: string; uic: number };

function formatChCode(chCode: string) {
  return chCode === '' ? 'BV' : chCode;
}

const StdcmOperationalPoint = ({
  pathStepId,
  updatePathStepLocation,
  pathStepLocation: location,
  disabled,
}: StdcmOperationalPointProps) => {
  const { t } = useTranslation('stdcm');

  const { searchTerm, chCodeFilter, sortedSearchResults, setSearchTerm, setChCodeFilter } =
    useSearchOperationalPoint({
      initialSearchTerm: location?.name,
      initialChCodeFilter: location?.secondaryCode || undefined,
    });

  const operationalPointsSuggestions = useMemo(
    () =>
      // Temporary filter added to show a more restrictive list of suggestions inside the stdcm app.
      sortedSearchResults
        .filter(
          (op) =>
            normalized(op.name).startsWith(normalized(searchTerm)) ||
            op.trigram === searchTerm.toUpperCase()
        )
        .reduce((acc, p) => {
          const newObject = {
            label: [p.trigram, p.name].join(' '),
            value: p.name,
            uic: p.uic,
          };
          const isDuplicate = acc.some((pr) => pr.label === newObject.label);
          if (!isDuplicate) acc.push(newObject);
          return acc;
        }, [] as Option[]),
    [sortedSearchResults]
  );

  const sortedChOptions = useMemo(
    () =>
      sortedSearchResults
        .filter((pr) => pr.name === searchTerm)
        .reduce(
          (acc, pr) => {
            const newObject = {
              label: formatChCode(pr.ch),
              id: pr.ch,
            };
            const isDuplicate = acc.some((option) => option.label === newObject.label);
            if (!isDuplicate) acc.push(newObject);
            return acc;
          },
          [] as { label: string; id: string }[]
        ),
    [location, sortedSearchResults]
  );

  const dispatchNewPoint = (p?: SearchResultItemOperationalPoint) => {
    if (p && p.ch === location?.secondaryCode && 'uic' in location && p.uic === location?.uic)
      return;

    const newLocation = p
      ? {
          name: p.name,
          uic: p.uic,
          secondaryCode: p.ch,
          coordinates: p.geographic.coordinates,
        }
      : undefined;
    updatePathStepLocation(newLocation);
  };

  const updateSelectedPoint = (
    refList: SearchResultItemOperationalPoint[],
    selectedUic: number,
    selectedChCode?: string
  ) => {
    const newPoint = refList.find(
      (pr) => pr.uic === selectedUic && (selectedChCode ? pr.ch === selectedChCode : true)
    );
    dispatchNewPoint(newPoint);
  };

  const onSelectSuggestion = (selectedSuggestion?: Option) => {
    if (!selectedSuggestion) {
      setSearchTerm('');
      return;
    }
    const { value: suggestionName, uic } = selectedSuggestion;
    setSearchTerm(suggestionName);
    updateSelectedPoint(sortedSearchResults, uic);
  };

  const onSelectChCodeFilter = (selectedChCode?: { id: string }) => {
    setChCodeFilter(selectedChCode?.id);
    if (location && 'uic' in location)
      updateSelectedPoint(sortedSearchResults, location.uic, selectedChCode?.id);
  };

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    if (e.target.value.trim().length === 0) {
      dispatchNewPoint(undefined);
    }
  };

  useEffect(() => {
    if (location) {
     setSearchTerm(location.name);
     setChCodeFilter(location.secondaryCode || undefined);
   } else {
     if (searchTerm !== '') {
       setSearchTerm('');
     }
     setChCodeFilter(undefined);
   }
  }, [location]);

  return (
    <div className="location-line">
      <div className="col-9 ci-input">
        <ComboBox
          id={`${pathStepId}-ci`}
          label={t('trainPath.ci')}
          value={searchTerm}
          onChange={onInputChange}
          autoComplete="off"
          suggestions={operationalPointsSuggestions}
          disabled={disabled}
          getSuggestionLabel={(option: Option) => option?.label}
          onSelectSuggestion={onSelectSuggestion}
          disableDefaultFilter
        />
      </div>
      <div className="col-3 p-0">
        <Select
          label={t('trainPath.ch')}
          id={`${pathStepId}-ch`}
          value={chCodeFilter ? { label: formatChCode(chCodeFilter), id: chCodeFilter } : undefined}
          onChange={(e) => onSelectChCodeFilter(e)}
          {...createFixedSelectOptions(sortedChOptions)}
          disabled={disabled}
        />
      </div>
    </div>
  );
};

export default StdcmOperationalPoint;
