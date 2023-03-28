import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import turfCenter from '@turf/center';
import nextId from 'react-id-generator';
import { Viewport, updateMapSearchMarker } from 'reducers/map';
import { useDebounce } from 'utils/helpers';
import { useTranslation } from 'react-i18next';
import { getMap } from 'reducers/map/selectors';
import { AllGeoJSON } from '@turf/helpers';
import MultiSelectSNCF from 'common/BootstrapSNCF/MultiSelectSNCF';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { getInfraID } from 'reducers/osrdconf/selectors';
import { ISignalSearchResult } from './searchTypes';
import { searchPayloadType, signalAspects } from '../const';
import SignalCard from './SignalCard';

type MapSearchSignalProps = {
  updateExtViewport: (viewport: Partial<Viewport>) => void;
};

export type SortType = {
  name: 'label' | 'type' | 'line_name' | 'line_code';
  order: number;
};

const SIGNAL_ASPECTS = signalAspects;

const MapSearchSignal = ({ updateExtViewport }: MapSearchSignalProps) => {
  const map = useSelector(getMap);
  const infraID = useSelector(getInfraID);

  const [searchState, setSearch] = useState('');
  const [searchLineState, setSearchLine] = useState('');
  const [aspect, setAspect] = useState<string[]>([]);
  const [searchResults, setSearchResults] = useState<ISignalSearchResult[]>([]);
  // Sort by, and order 0 = ASC, 1 = DESC
  const [sortFilter, setSortFilter] = useState<SortType>({
    name: 'label',
    order: 0,
  });
  const dispatch = useDispatch();
  const [postSearch] = osrdEditoastApi.usePostSearchMutation();
  const { t } = useTranslation(['translation', 'map-search']);

  const updateSearch = async (params: searchPayloadType) => {
    await postSearch({
      body: { object: params.object, query: params.query },
    })
      .unwrap()
      .then((results) => {
        setSearchResults(results as ISignalSearchResult[]);
      })
      .catch((error) => {
        console.error(error);
        setSearchResults([]);
      });
  };

  const debouncedSearchTerm = useDebounce(searchState, 300);
  const debouncedSearchLine = useDebounce(searchLineState, 300);

  const getPayload = () => {
    let playloadQuery: (string | number | string[])[] = ['search', ['line_name'], searchState];

    if (searchLineState) playloadQuery = ['=', ['line_code'], Number(searchLineState)];

    const aspectQuery = aspect.join(' ');
    const payload = {
      object: 'signal',
      query: [
        'and',
        ['=', ['infra_id'], infraID],
        playloadQuery,
        !aspectQuery || ['contains', ['list', aspectQuery], ['aspects']],
      ],
    };

    return payload;
  };

  useEffect(() => {
    if (searchState || searchLineState) {
      updateSearch(getPayload());
    }
    if (!searchState && !searchLineState) {
      setSearchResults([]);
    }
  }, [debouncedSearchTerm, debouncedSearchLine, aspect]);

  const onResultClick = (result: ISignalSearchResult) => {
    const coordinates = map.mapTrackSources === 'schematic' ? result.schematic : result.geographic;

    const center = turfCenter(coordinates as AllGeoJSON);

    const newViewport = {
      ...map.viewport,
      longitude: center.geometry.coordinates[0],
      latitude: center.geometry.coordinates[1],
      zoom: 12,
    };
    updateExtViewport(newViewport);
    dispatch(
      updateMapSearchMarker({
        title: result.label,
        lonlat: [center.geometry.coordinates[0], center.geometry.coordinates[1]],
      })
    );
  };

  const formatSearchResults = () => {
    let searchResultsContent = searchResults.filter((result) => result.label !== null);
    searchResultsContent = searchResultsContent.sort((a, b) => {
      if (!a[sortFilter.name]) {
        return sortFilter.order === 0 ? -1 : 1;
      } // To avoid null values
      if (!b[sortFilter.name]) {
        return sortFilter.order === 0 ? 1 : -1;
      }
      return sortFilter.order === 0
        ? String(a[sortFilter.name]).localeCompare(String(b[sortFilter.name]))
        : String(b[sortFilter.name]).localeCompare(String(a[sortFilter.name]));
    });

    return (
      <div className="search-results">
        {searchResultsContent.map((result) => (
          <SignalCard
            signalSearchResult={result}
            onResultClick={onResultClick}
            key={`mapSearchSignal-${nextId()}-${result.line_name}`}
          />
        ))}
      </div>
    );
  };

  const orderDisplay = (name: string) => {
    if (name === sortFilter.name) {
      return sortFilter.order === 0 ? (
        <i className="icons-arrow-down icons-size-x5 ml-1" />
      ) : (
        <i className="icons-arrow-up icons-size-x5 ml-1" />
      );
    }
    return null;
  };

  const setSortName = (name: typeof sortFilter.name) => {
    if (name === sortFilter.name) {
      setSortFilter({ name, order: 1 - sortFilter.order });
    } else {
      setSortFilter({ name, order: 0 });
    }
  };

  return (
    <>
      <div className="row mr-2">
        <div className="col-sm-6">
          <InputSNCF
            label={t('map-search:name')}
            type="text"
            placeholder={t('map-search:placeholdername')}
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
          />
        </div>
        <div className="col-sm-6">
          <InputSNCF
            label={t('map-search:linecode')}
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
          />
        </div>
      </div>
      <div>
        <MultiSelectSNCF
          multiSelectTitle="Aspect"
          multiSelectSubTitle="Tout les Aspects"
          selectOptions={SIGNAL_ASPECTS}
          onChange={setAspect}
          selectedValues={aspect}
        />
      </div>
      <div>
        {searchResults?.length > 0 ? (
          <>
            <div className="row mt-3 px-3 small no-gutters justify-content-between">
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
                className="col-2 search-results-label"
                role="button"
                onClick={() => setSortName('line_code')}
                tabIndex={-1}
              >
                {t('map-search:linecode')}
                {orderDisplay('line_code')}
              </div>
              <div
                className="col-3 search-results-label"
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
        ) : (
          <h2 className="text-center mt-3">{t('map-search:noresult')}</h2>
        )}
      </div>
    </>
  );
};

export default MapSearchSignal;
