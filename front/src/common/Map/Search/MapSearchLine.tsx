import React, { useEffect, useState } from 'react';
import { getMap } from 'reducers/map/selectors';
import { getInfraID } from 'reducers/osrdconf/selectors';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { updateLineSearchCode, updateMapSearchMarker } from 'reducers/map';
import { useDebounce } from 'utils/helpers';
import { useSelector, useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import bbox from '@turf/bbox';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import LineCard from 'common/Map/Search/LineCard';
import nextId from 'react-id-generator';
import WebMercatorViewport from 'viewport-mercator-project';

import type { Viewport } from 'reducers/map';
import type { Zone, SearchResultItemTrack, SearchPayload } from 'common/api/osrdEditoastApi';
import type { BBox } from '@turf/helpers';

type MapSearchLineProps = {
  updateExtViewport: (viewport: Partial<Viewport>) => void;
  closeMapSearchPopUp: () => void;
};

const MapSearchLine = ({ updateExtViewport, closeMapSearchPopUp }: MapSearchLineProps) => {
  const infraID = useSelector(getInfraID);
  const map = useSelector(getMap);
  const { t } = useTranslation(['map-search']);
  const dispatch = useDispatch();
  const [postSearch] = osrdEditoastApi.usePostSearchMutation();
  const [searchState, setSearchState] = useState<string>('');
  const [searchResults, setSearchResults] = useState<SearchResultItemTrack[] | undefined>(
    undefined
  );
  const [getTrackZones, { data: trackZones }] =
    osrdEditoastApi.endpoints.getInfraByIdLinesAndLineCodeBbox.useLazyQuery({});

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

    const newViewport = {
      ...map.viewport,
      longitude,
      latitude,
      zoom,
    };
    updateExtViewport(newViewport);
  };

  const debouncedSearchTerm = useDebounce(searchState, 300);

  const updateSearch = async (searchPayload: SearchPayload) => {
    try {
      const results = await postSearch({ searchPayload }).unwrap();
      setSearchResults(results as SearchResultItemTrack[]);
    } catch (e) {
      console.error(e);
      setSearchResults(undefined);
    }
  };

  const getPayload = (lineSearch: string, infraIDPayload: number): SearchPayload => {
    const playloadQuery: (string | number | string[])[] = !Number.isNaN(Number(lineSearch))
      ? ['=', ['line_code'], Number(lineSearch)]
      : ['search', ['line_name'], lineSearch];

    return {
      object: 'track',
      query: ['and', ['=', ['infra_id'], infraIDPayload], playloadQuery],
    };
  };

  const coordinates = (search: Zone) => search.geo;

  const onResultClick = async (searchResultItem: SearchResultItemTrack) => {
    if (map.mapSearchMarker) {
      dispatch(updateMapSearchMarker(undefined));
    }
    getTrackZones({ id: infraID as number, lineCode: searchResultItem.line_code });
    dispatch(updateLineSearchCode(searchResultItem.line_code));
  };

  useEffect(() => {
    if (searchState && infraID) {
      updateSearch(getPayload(searchState, infraID));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearchTerm]);

  useEffect(() => {
    if (trackZones) {
      const tempBbox = bbox({
        type: 'LineString',
        coordinates: coordinates(trackZones),
      });
      zoomToFeature(tempBbox);
      closeMapSearchPopUp();
    }
  }, [trackZones]);

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
            }}
            onClear={clearSearchResult}
            value={searchState}
            clearButton
            noMargin
            sm
            focus
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
