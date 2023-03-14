import React, { useEffect, useState } from 'react';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import { useTranslation } from 'react-i18next';
import { useDebounce } from 'utils/helpers';
import { post, get } from 'common/requests';
import { useSelector, useDispatch } from 'react-redux';
import { getInfraID } from 'reducers/osrdconf/selectors';
import { Viewport, updateLineSearchCode, updateMapSearchMarker } from 'reducers/map';
import nextId from 'react-id-generator';
import { BBox, LineString } from '@turf/helpers';
import bbox from '@turf/bbox';
import WebMercatorViewport from 'viewport-mercator-project';
import { RootState } from 'reducers';
import { SEARCH_URL, searchPayloadType } from '../const';
import LineCard from './LineCard';
import { ILineSearchResult } from './searchTypes';

type MapSearchLineProps = {
  updateExtViewport: (viewport: Partial<Viewport>) => void;
};

const MapSearchLine: React.FC<MapSearchLineProps> = ({ updateExtViewport }) => {
  const infraID = useSelector(getInfraID);
  const { t } = useTranslation(['map-search']);
  const map = useSelector((state: RootState) => state.map);
  const dispatch = useDispatch();

  const [searchState, setSearchState] = useState<string>('');
  const [dontSearch, setDontSearch] = useState(false);
  const [searchResults, setSearchResults] = useState<ILineSearchResult[] | undefined>(undefined);

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
    updateExtViewport(newViewport);
  };

  const debouncedSearchTerm = useDebounce(searchState, 300);

  const updateSearch = async (params: searchPayloadType | null) => {
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
        object: 'track',
        query: ['and', ['=', ['infra_id'], infraID], ['=', ['line_code'], Number(lineSearch)]],
      };
    }

    return payload;
  };
  const coordinates = (search: { [key: string]: LineString }) =>
    map.mapTrackSources === 'schematic' ? search.sch : search.geo;

  const getTrackBbox = async (searchItem: ILineSearchResult) => {
    const trackZones = await get(`/editoast/infra/${infraID}/lines/${searchItem.line_code}/bbox`);
    return {
      type: 'LineString',
      coordinates: coordinates(trackZones),
    };
  };

  const onResultClick = async (searchResultItem: ILineSearchResult) => {
    if (map.mapSearchMarker) {
      dispatch(updateMapSearchMarker(undefined));
    }
    const trackBox = await getTrackBbox(searchResultItem);
    const tempBbox = bbox(trackBox);
    zoomToFeature(tempBbox);
    dispatch(updateLineSearchCode(searchResultItem.line_code));
  };

  useEffect(() => {
    if (!dontSearch && debouncedSearchTerm) {
      updateSearch(getPayload(searchState));
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearchTerm]);

  const clearSearchResult = () => {
    setSearchState('');
    setSearchResults(undefined);
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
      <h2 className="text-center mt-3">
        {t('map-search:resultsCount', { count: searchResults ? searchResults.length : 0 })}
      </h2>
      <div className="search-results">
        {searchResults &&
          searchResults.map((result) => (
            <LineCard key={nextId()} resultSearchItem={result} onResultClick={onResultClick} />
          ))}
      </div>
    </>
  );
};

export default MapSearchLine;
