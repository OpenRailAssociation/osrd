import React, { useEffect, useState } from 'react';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import { useTranslation } from 'react-i18next';
import { useDebounce } from 'utils/helpers';
import { post } from 'common/requests';
import { useSelector, useDispatch } from 'react-redux';
import { getInfraID } from 'reducers/osrdconf/selectors';
import { Viewport, updateMapSearchMarker } from 'reducers/map';
import nextId from 'react-id-generator';
import { BBox, MultiLineString, multiLineString } from '@turf/helpers';
import bbox from '@turf/bbox';
import WebMercatorViewport from 'viewport-mercator-project';
import { RootState } from 'reducers';
import { SEARCH_URL, searchPayloadType } from '../const';
import SearchResultItem from './SearchResultItem';
import { useSearchContext } from './SearchContext';

type MapSearchLineProps = {
  updateExtViewport: (viewport: Partial<Viewport>) => void;
};

const MapSearchLine: React.FC<MapSearchLineProps> = ({ updateExtViewport }) => {
  const infraID = useSelector(getInfraID);
  const { t } = useTranslation(['map-search']);
  const map = useSelector((state: RootState) => state.map);
  const searchContext = useSearchContext();
  const dispatch = useDispatch();

  const [searchState, setSearchState] = useState<string>('');
  const [dontSearch, setDontSearch] = useState(false);
  const [searchResults, setSearchResults] = useState<{ [key: string]: string }[] | undefined>(
    undefined
  );
  const [geoResult, setGeoResult] = useState<MultiLineString | undefined>(undefined);

  const zoomToFeature = (boundingBox: BBox) => {
    const [minLng, minLat, maxLng, maxLat] = boundingBox;
    const viewportTemp = new WebMercatorViewport({ ...map.viewport, width: 600, height: 400 });
    const { longitude, latitude, zoom } = viewportTemp.fitBounds(
      [
        [minLng, minLat],
        [maxLng, maxLat],
      ],
      { padding: 40 }
    );
    const tempMap = { ...map };
    const newViewport = {
      ...tempMap.viewport,
      longitude,
      latitude,
      zoom,
    };
    console.log('map.viewport', map.viewport);
    console.log('newViewport', newViewport);
    updateExtViewport(newViewport);
  };

  useEffect(() => {
    if (searchContext?.lineSearch && geoResult) {
      const features = multiLineString(geoResult.coordinates);
      zoomToFeature(bbox(features));
    }
  }, [searchContext?.lineSearch]);

  const debouncedSearchTerm = useDebounce(searchState, 300);

  const updateSearch = async (params: searchPayloadType | null) => {
    console.log('line');
    try {
      const data = await post(SEARCH_URL, params);
      setSearchResults(data);
    } catch (e) {
      console.error(e);
    }
  };

  const getPayload = (lineSearch: string) => {
    let payload = {
      object: 'track',
      query: ['and', ['=', ['infra_id'], infraID], ['search', ['line_name'], lineSearch]],
    };

    if (!Number.isNaN(Number(lineSearch))) {
      payload = {
        object: 'geo_track',
        query: ['and', ['=', ['infra_id'], infraID], ['=', ['line_code'], Number(lineSearch)]],
      };
    }

    return payload;
  };

  const coordinates = (search: { [key: string]: string | MultiLineString }) =>
    map.mapTrackSources === 'schematic' ? search.schematic : search.geographic;

  const onResultClick = async (searchResultItem: { [key: string]: string | MultiLineString }) => {
    dispatch(updateMapSearchMarker(undefined));

    if (searchResultItem.geographic || searchResultItem.schematic) {
      setGeoResult(coordinates(searchResultItem) as MultiLineString);
    } else {
      const payload = getPayload(searchResultItem.line_code as string);

      try {
        const data = await post(SEARCH_URL, payload);
        setGeoResult(coordinates(data[0]) as MultiLineString);
      } catch (e) {
        console.error(e);
      }
    }
  };

  useEffect(() => {
    searchContext?.setLineSearch(geoResult || searchContext?.lineSearch);
    searchContext?.setIsSearchLine(true);
  }, [geoResult]);

  useEffect(() => {
    if (!dontSearch && debouncedSearchTerm) {
      updateSearch(getPayload(searchState));
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearchTerm]);

  const formatSearchResults = () => {
    const searchResultsContent = searchResults;

    return searchResultsContent?.map((result) => (
      <SearchResultItem key={nextId()} resultSearchItem={result} onResultClick={onResultClick} />
    ));
  };

  const clearSearchResult = () => {
    setSearchState('');
    setSearchResults(undefined);
    searchContext?.setIsSearchLine(false);
    searchContext?.setLineSearch(undefined);
  };

  return (
    <>
      <div className="d-flex mb-2">
        <span className="flex-grow-1">
          <InputSNCF
            type="text"
            placeholder={t('map-search:placeholderline')}
            id="map-search-line"
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              setSearchState(e.target.value);
              setDontSearch(false);
            }}
            onClear={clearSearchResult}
            value={searchState}
            clearButton
            noMargin
            sm
            // focus
          />
        </span>
      </div>
      <div style={{ maxHeight: '200px', overflow: 'auto' }}>
        {searchResults !== undefined && searchResults.length > 0 ? (
          <div className="search-results pt-1 pl-1 pr-2">{formatSearchResults()}</div>
        ) : (
          <h2 className="text-center mt-3">{t('map-search:noresult')}</h2>
        )}
      </div>
    </>
  );
};

export default MapSearchLine;
