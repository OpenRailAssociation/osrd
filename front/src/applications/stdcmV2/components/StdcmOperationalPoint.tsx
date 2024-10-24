import { useEffect, useMemo, useState } from 'react';

import { Select, ComboBox } from '@osrd-project/ui-core';
import { useTranslation } from 'react-i18next';
import nextId from 'react-id-generator';

import type { SearchResultItemOperationalPoint } from 'common/api/osrdEditoastApi';
import useSearchOperationalPoint from 'common/Map/Search/useSearchOperationalPoint';
import type { PathStep } from 'reducers/osrdconf/types';
import { normalized } from 'utils/strings';
import { createFixedSelectOptions } from 'utils/uiCoreHelpers';

type StdcmOperationalPointProps = {
  updatePoint: (pathStep: PathStep | null) => void;
  point: PathStep | null;
  opPointId: string;
  disabled?: boolean;
};

type Option = { label: string; value: string; uic: number };

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
  const [suggestionsVisible, setSuggestionsVisible] = useState(false);

  const { searchTerm, chCodeFilter, sortedSearchResults, setSearchTerm, setChCodeFilter } =
    useSearchOperationalPoint({ initialSearchTerm: point?.name, initialChCodeFilter: point?.ch });

  const operationalPointsSuggestions = useMemo(
    () =>
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
    [point, sortedSearchResults]
  );

  const dispatchNewPoint = (p?: SearchResultItemOperationalPoint) => {
    if (p && p.ch === point?.ch && 'uic' in point && p.uic === point?.uic) return;
    const newPoint = p
      ? {
          name: p.name,
          ch: p.ch,
          id: point?.id || nextId(),
          uic: p.uic,
          coordinates: p.geographic.coordinates,
        }
      : null;
    updatePoint(newPoint);
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
    if (point && 'uic' in point)
      updateSelectedPoint(sortedSearchResults, point.uic, selectedChCode?.id);
  };

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    if (e.target.value.trim().length === 0) {
      dispatchNewPoint(undefined);
    } else {
      setSuggestionsVisible(true);
    }
  };

  const handleBlur = () => {
    setSuggestionsVisible(false);
  };

  useEffect(() => {
    if (point) {
      setSearchTerm(point.name || '');
      setChCodeFilter(point.ch || '');
    } else {
      setSearchTerm('');
      setChCodeFilter(undefined);
    }
  }, [point]);

  return (
    <div className="location-line">
      <div className="col-9 ci-input">
        <ComboBox
          id={`${opPointId}-ci`}
          label={t('trainPath.ci')}
          value={searchTerm}
          onChange={onInputChange}
          onBlur={handleBlur}
          autoComplete="off"
          suggestions={suggestionsVisible ? operationalPointsSuggestions : []}
          disabled={disabled}
          getSuggestionLabel={(option: Option) => option?.label}
          onSelectSuggestion={onSelectSuggestion}
          disableDefaultFilter
        />
      </div>
      <div className="col-3 p-0">
        <Select
          label={t('trainPath.ch')}
          id={`${opPointId}-ch`}
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
