import React, { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import nextId from 'react-id-generator';
import { useTranslation } from 'react-i18next';
import { sortBy } from 'lodash';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import MultiSelectSNCF from 'common/BootstrapSNCF/MultiSelectSNCF';
import { useDebounce } from 'utils/helpers';
import { Viewport } from 'reducers/map';
import { getMap } from 'reducers/map/selectors';
import { SearchSignalResult, osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { getInfraID } from 'reducers/osrdconf/selectors';
import { setFailure } from 'reducers/main';
import { searchPayloadType, signalAspects } from '../const';
import SignalCard from './SignalCard';
import { onResultSearchClick } from '../utils';

type MapSearchSignalProps = {
  updateExtViewport: (viewport: Partial<Viewport>) => void;
  closeMapSearchPopUp: () => void;
};

export type SortType = {
  name: 'label' | 'type' | 'line_name' | 'line_code';
  asc: boolean;
};

const SIGNAL_ASPECTS = signalAspects;

const MapSearchSignal = ({ updateExtViewport, closeMapSearchPopUp }: MapSearchSignalProps) => {
  const map = useSelector(getMap);
  const infraID = useSelector(getInfraID);

  const [searchState, setSearch] = useState('');
  const [searchLineState, setSearchLine] = useState('');
  const [aspects, setAspects] = useState<string[]>([]);
  const [searchResults, setSearchResults] = useState<SearchSignalResult[]>([]);
  const [autocompleteLineNames, setAutocompleteLineNames] = useState<string[]>([]);
  const [searchSignalWidth, setSearchSignalWidth] = useState<number>(0);

  // Sort by, and order true = ASC, false = DESC
  const [sortFilter, setSortFilter] = useState<SortType>({
    name: 'label',
    asc: true,
  });
  const dispatch = useDispatch();
  const [postSearch] = osrdEditoastApi.usePostSearchMutation();
  const { t } = useTranslation(['translation', 'map-search']);

  const getPayload = (
    lineSearch: string,
    signalName: string,
    infraIDPayload: number
  ): searchPayloadType => {
    const payloadQuery = !Number.isNaN(Number(lineSearch))
      ? ['=', ['line_code'], Number(lineSearch)]
      : ['search', ['line_name'], lineSearch];

    return {
      object: 'signal',
      query: [
        'and',
        ['=', ['infra_id'], infraIDPayload],
        !lineSearch || payloadQuery,
        !aspects.length || ['contains', ['list', ...aspects], ['aspects']],
        ['search', ['label'], signalName],
      ],
    };
  };

  const updateSearch = async (infraIDPayload: number) => {
    const payload: searchPayloadType = getPayload(searchLineState, searchState, infraIDPayload);
    await postSearch({
      body: payload,
    })
      .unwrap()
      .then((results) => {
        setSearchResults([...results] as SearchSignalResult[]);
      })
      .catch((e) => {
        console.error(e);
        setSearchResults([]);
        dispatch(
          setFailure({
            name: t('map-search:errorMessages.unableToSearchSignal'),
            message: `${e.message}`,
          })
        );
      });
  };

  const debouncedSearchTerm = useDebounce(searchState, 300);
  const debouncedSearchLine = useDebounce(searchLineState, 300);

  useEffect(() => {
    if ((searchLineState || searchState) && infraID) {
      updateSearch(infraID);
    } else {
      setSearchResults([]);
    }
  }, [debouncedSearchTerm, debouncedSearchLine, aspects]);

  const onResultClick = (result: SearchSignalResult) => {
    onResultSearchClick({
      result,
      map,
      updateExtViewport,
      dispatch,
      title: result.label,
    });

    closeMapSearchPopUp();
  };

  useEffect(() => {
    const sortedResults = sortBy(searchResults, sortFilter.name);
    if (sortFilter.asc) {
      setSearchResults(sortedResults.reverse());
    } else {
      setSearchResults(sortedResults);
    }
  }, [sortFilter]);

  useEffect(() => {
    const lineNames = searchResults.map((result) => result.line_name);
    setAutocompleteLineNames([...new Set(lineNames)]);
  }, [searchLineState]);

  const formatSearchResults = () => (
    <div className="search-results">
      {searchResults.map((result) => (
        <SignalCard
          signalSearchResult={result}
          onResultClick={onResultClick}
          key={`mapSearchSignal-${nextId()}-${result.line_name}`}
        />
      ))}
    </div>
  );

  const orderDisplay = (name: string) => {
    if (name === sortFilter.name) {
      return sortFilter.asc ? (
        <i className="icons-arrow-up icons-size-x5 ml-1" />
      ) : (
        <i className="icons-arrow-down icons-size-x5 ml-1" />
      );
    }
    return null;
  };

  const setSortName = (name: typeof sortFilter.name) => {
    setSortFilter({ name, asc: name === sortFilter.name ? !sortFilter.asc : false });
  };

  const divRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (divRef.current) setSearchSignalWidth(divRef.current.offsetWidth);
  }, [divRef.current?.offsetWidth]);

  const classLargeCol = searchSignalWidth > 768 ? 'col-lg-4' : '';

  return (
    <>
      <div className="row mb-2 search-signal" ref={divRef}>
        <div className={`${classLargeCol} col-md-6 mb-2`}>
          <InputSNCF
            label={t('map-search:line')}
            type="text"
            placeholder={t('map-search:placeholderline')}
            id="map-search-signal-line"
            onChange={(e) => {
              setSearchLine(e.target.value);
            }}
            onClear={() => {
              setSearchLine('');
            }}
            value={searchLineState}
            clearButton
            noMargin
            sm
            list="line"
          />
          <datalist id="line" className="overflow-hidden">
            {searchLineState &&
              autocompleteLineNames.map((lineName) => (
                <option value={lineName} key={lineName}>
                  {lineName}
                </option>
              ))}
          </datalist>
        </div>
        <div className={`${classLargeCol} col-md-6 mb-2`}>
          <InputSNCF
            label={t('map-search:signal')}
            type="text"
            placeholder={t('map-search:placeholdersignal')}
            id="map-search-signal"
            onChange={(e) => {
              setSearch(e.target.value);
            }}
            onClear={() => {
              setSearch('');
              setSearchResults([]);
            }}
            value={searchState}
            clearButton
            noMargin
            sm
            list="signal"
          />
          <datalist id="signal">
            {searchState &&
              searchResults.map((result) => (
                <option value={result.label} key={`${result.label}-${result.line_name}`}>
                  {result.label}
                </option>
              ))}
          </datalist>
        </div>
        <div className={`${classLargeCol} ${searchSignalWidth < 470 ? 'col-md-12' : 'col-md-6'}`}>
          <MultiSelectSNCF
            multiSelectTitle={t('map-search:aspects')}
            multiSelectPlaceholder={t('map-search:noAspectSelected')}
            options={SIGNAL_ASPECTS}
            onChange={setAspects}
            selectedValues={aspects}
          />
        </div>
      </div>
      <h2 className="text-center mt-3">
        {t('map-search:resultsCount', { count: searchResults ? searchResults.length : 0 })}
      </h2>
      <div>
        {searchResults?.length > 0 && (
          <>
            <div className="row mt-3 mb-2 px-3 small no-gutters justify-content-between">
              <div
                className="col-1 search-results-label"
                role="button"
                onClick={() => setSortName('type')}
                tabIndex={-1}
              >
                {t('map-search:type')}
                {orderDisplay('type')}
              </div>
              <div
                className="col-1 search-results-label"
                role="button"
                onClick={() => setSortName('label')}
                tabIndex={-1}
              >
                {t('map-search:name')}
                {orderDisplay('label')}
              </div>
              <div
                className="col-3 search-results-label"
                role="button"
                onClick={() => setSortName('line_code')}
                tabIndex={-1}
              >
                {t('map-search:linecode')}
                {orderDisplay('line_code')}
              </div>
              <div
                className="col-6 search-results-label"
                role="button"
                onClick={() => setSortName('line_name')}
                tabIndex={-1}
              >
                {t('map-search:line')}
                {orderDisplay('line_name')}
              </div>
            </div>
            {formatSearchResults()}
          </>
        )}
      </div>
    </>
  );
};

export default MapSearchSignal;
