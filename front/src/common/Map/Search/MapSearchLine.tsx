import React, { useEffect, useState } from 'react';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import { useTranslation } from 'react-i18next';
import { useDebounce } from 'utils/helpers';
import { useSelector, useDispatch } from 'react-redux';
import { getInfraID } from 'reducers/osrdconf/selectors';
import { Viewport, updateLineSearchCode, updateMapSearchMarker } from 'reducers/map';
import nextId from 'react-id-generator';
import { BBox } from '@turf/helpers';
import bbox from '@turf/bbox';
import WebMercatorViewport from 'viewport-mercator-project';
import { getMap } from 'reducers/map/selectors';
import { Zone, osrdEditoastApi, SearchTrackResult } from 'common/api/osrdEditoastApi';
import { searchPayloadType } from '../const';
import LineCard from './LineCard';

type MapSearchLineProps = {
  updateExtViewport: (viewport: Partial<Viewport>) => void;
};

const MapSearchLine: React.FC<MapSearchLineProps> = ({ updateExtViewport }) => {
  const infraID = useSelector(getInfraID);
  const map = useSelector(getMap);
  const { t } = useTranslation(['map-search']);
  const dispatch = useDispatch();
  const [postSearch] = osrdEditoastApi.usePostSearchMutation();
  const [searchState, setSearchState] = useState<string>('');
  const [searchResults, setSearchResults] = useState<SearchTrackResult[] | undefined>(undefined);
  const [dataTrackZone, setDataTrackZone] = useState<{ id: number; lineCode: number }>({
    id: 0,
    lineCode: 0,
  });
  const [skip, setSkip] = useState<boolean>(true);

  const { data: trackZones } = osrdEditoastApi.useGetInfraByIdLinesAndLineCodeBboxQuery(
    dataTrackZone,
    { skip }
  );

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

  const updateSearch = async (params: searchPayloadType) => {
    try {
      const results = await postSearch({
        body: { object: params.object, query: params.query },
      }).unwrap();
      setSearchResults(results as SearchTrackResult[]);
    } catch (e) {
      console.error(e);
      setSearchResults(undefined);
    }
  };

  const getPayload = (lineSearch: string, infraIDPayload: number): searchPayloadType => {
    const playloadQuery: (string | number | string[])[] = !Number.isNaN(Number(lineSearch))
      ? ['=', ['line_code'], Number(lineSearch)]
      : ['search', ['line_name'], lineSearch];

    return {
      object: 'track',
      query: ['and', ['=', ['infra_id'], infraIDPayload], playloadQuery],
    };
  };

  const coordinates = (search: Zone) =>
    map.mapTrackSources === 'schematic' ? search.sch : search.geo;

  const onResultClick = async (searchResultItem: SearchTrackResult) => {
    if (map.mapSearchMarker) {
      dispatch(updateMapSearchMarker(undefined));
    }
    setSkip(false);
    setDataTrackZone({ id: infraID as number, lineCode: searchResultItem.line_code });

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
