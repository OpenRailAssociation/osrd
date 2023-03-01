import React, { useEffect, useState } from 'react';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import { useTranslation } from 'react-i18next';
import { useDebounce } from 'utils/helpers';
import { post } from 'common/requests';
import { useDispatch, useSelector } from 'react-redux';
import { getInfraID } from 'reducers/osrdconf/selectors';
import { Viewport, updateMapSearchMarker } from 'reducers/map';
import nextId from 'react-id-generator';
import { BBox, Position, lineString } from '@turf/helpers';
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
  const [searchState, setSearchState] = useState<string>('');
  const [dontSearch, setDontSearch] = useState(false);
  const [searchResults, setSearchResults] = useState<{ [key: string]: string }[] | undefined>(
    undefined
  );
  const map = useSelector((state: RootState) => state.map);
  const searchContext = useSearchContext();

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
    updateExtViewport({
      ...map.viewport,
      longitude,
      latitude,
      zoom,
    });
  };

  useEffect(() => {
    if (searchContext?.lineSearch) {
      const features = lineString(searchContext?.lineSearch.coordinates);
      console.log('features:', features);
      // setGeojsonPath(features);
      zoomToFeature(bbox(features));
    }
  }, [searchContext?.lineSearch]);

  const infraID = useSelector(getInfraID);

  const dispatch = useDispatch();

  const { t } = useTranslation(['map-search']);

  const debouncedSearchTerm = useDebounce(searchState, 300);

  const updateSearch = async (params: searchPayloadType) => {
    try {
      const data = await post(SEARCH_URL, params);
      setSearchResults(data);
    } catch (e) {
      console.error(e);
    }
  };

  const getPayload = () => {
    let lineName = null;
    let lineCode = null;

    if (!dontSearch && debouncedSearchTerm) {
      if (!Number.isNaN(Number(searchState))) {
        lineName = null;
        lineCode = searchState;
      } else {
        lineName = searchState;
        lineCode = null;
      }
    }

    const payload = {
      object: 'tracksection',
      query: [
        'and',
        ['or', ['search', ['line_name'], lineName], ['search', ['line_code'], lineCode]],
        ['=', ['infra_id'], infraID],
      ],
    };
    return payload;
  };

  const onResultClick = (searchResultItem: { [key: string]: string | Position[] }) => {
    if (searchContext?.setLineSearch && searchContext?.setIsSearchLine) {
      searchContext?.setLineSearch(searchResultItem.geographic);
      searchContext?.setIsSearchLine(true);
    }
  };

  useEffect(() => {
    updateSearch(getPayload());

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
    dispatch(updateMapSearchMarker(undefined));
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
