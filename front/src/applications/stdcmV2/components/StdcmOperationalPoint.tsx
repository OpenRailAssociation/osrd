import React, { useEffect, useMemo } from 'react';

import { Select } from '@osrd-project/ui-core';
import { useTranslation } from 'react-i18next';
import nextId from 'react-id-generator';

import type { SearchResultItemOperationalPoint } from 'common/api/osrdEditoastApi';
import useSearchOperationalPoint from 'common/Map/Search/useSearchOperationalPoint';
import type { PathStep } from 'reducers/osrdconf/types';

import StdcmSuggestions from './StdcmSuggestions';

type StdcmOperationalPointProps = {
  updatePoint: (pathStep: PathStep | null) => void;
  point: PathStep | null;
  opPointId: string;
  disabled?: boolean;
};

function formatChCode(chCode: string) {
  return chCode === '' ? 'BV' : chCode;
}

const StdcmOperationalPoint = ({
  updatePoint,
  point,
  opPointId,
  disabled,
}: StdcmOperationalPointProps) => {
  const { t } = useTranslation('stdcm');

  const {
    searchTerm,
    chCodeFilter,
    sortedSearchResults,
    filteredAndSortedSearchResults,
    setSearchTerm,
    setChCodeFilter,
  } = useSearchOperationalPoint({
    initialSearchTerm: point?.name,
    initialChCodeFilter: (point && 'uic' in point && point.secondary_code) || undefined,
  });

  const operationalPointsSuggestions = useMemo(
    () =>
      sortedSearchResults.reduce(
        (acc, p) => {
          const newObject = {
            label: [p.trigram, p.name].join(' '),
            value: p.name,
            uic: p.uic,
          };
          const isDuplicate = acc.some((pr) => pr.label === newObject.label);
          if (!isDuplicate) acc.push(newObject);
          return acc;
        },
        [] as { label: string; value: string; uic: number }[]
      ),
    [sortedSearchResults]
  );

  const sortedChOptions = useMemo(
    () =>
      sortedSearchResults.reduce(
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
    [point, sortedSearchResults]
  );

  const dispatchNewPoint = (p?: SearchResultItemOperationalPoint) => {
    if (p && point && 'uic' in point && p.uic === point.uic && p.ch === point.secondary_code)
      return;
    const newPoint = p
      ? {
          name: p.name,
          ch: p.ch,
          id: nextId(),
          uic: p.uic,
          coordinates: p.geographic.coordinates,
        }
      : null;
    updatePoint(newPoint);
  };

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    if (e.target.value.trim().length === 0) {
      dispatchNewPoint(undefined);
    }
  };

  const onInputOnblur = () => {
    const newPoint =
      operationalPointsSuggestions.length === 1
        ? filteredAndSortedSearchResults.find(
            (pr) => pr.name === operationalPointsSuggestions[0].value
          )
        : undefined;
    dispatchNewPoint(newPoint);
    if (newPoint === undefined) {
      setSearchTerm('');
      setChCodeFilter(undefined);
    }
  };

  useEffect(() => {
    if (point) {
      const ch = 'uic' in point ? point.secondary_code : '';
      setSearchTerm(point.name || '');
      setChCodeFilter(ch || '');
    } else {
      setSearchTerm('');
      setChCodeFilter(undefined);
    }
  }, [point]);

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

  const onSelectSuggestion = ({ value: suggestionName, uic }: { value: string; uic: number }) => {
    setSearchTerm(suggestionName);
    updateSelectedPoint(sortedSearchResults, uic);
  };

  const onSelectChCodeFilter = (selectedChCode?: { id: string }) => {
    setChCodeFilter(selectedChCode?.id);
    if (point && 'uic' in point)
      updateSelectedPoint(sortedSearchResults, point.uic, selectedChCode?.id);
  };

  return (
    <div className="flex">
      <div className="suggestions col-9">
        {/* Those components will be replaced by their ui-core versions when they're ready (#7712) */}
        <StdcmSuggestions
          id={`${opPointId}-ci`}
          label={t('trainPath.ci')}
          value={searchTerm}
          onChange={onInputChange}
          onBlur={onInputOnblur}
          options={operationalPointsSuggestions}
          onSelectSuggestion={onSelectSuggestion}
          disabled={disabled}
        />
      </div>
      <div className="suggestions stdcm-v2-ch-selector w-100 px-1 pb-2 col-3">
        <Select
          label={t('trainPath.ch')}
          id={`${opPointId}-ch`}
          value={chCodeFilter ? { label: formatChCode(chCodeFilter), id: chCodeFilter } : undefined}
          options={sortedChOptions}
          onChange={(e) => onSelectChCodeFilter(e)}
          getOptionLabel={(option) => option?.label ?? ''}
          getOptionValue={(option) => option?.id ?? ''}
          disabled={disabled}
        />
      </div>
    </div>
  );
};

export default StdcmOperationalPoint;
