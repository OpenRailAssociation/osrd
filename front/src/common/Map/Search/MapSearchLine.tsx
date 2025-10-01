import { useEffect, useState } from 'react';

import bbox from '@turf/bbox';
import { useTranslation } from 'react-i18next';

import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import type { BoundingBox, SearchResultItemTrack } from 'common/api/osrdEditoastApi';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import { computeBBoxViewport } from 'common/Map/WarpedMap/core/helpers';
import { useInfraID } from 'common/osrdContext';
import { useMapSettingsActions } from 'reducers/commonMap';
import type { MapSettings, Viewport } from 'reducers/commonMap/types';
import { useAppDispatch } from 'store';
import { useDebounce } from 'utils/helpers';

type MapSearchLineProps = {
  updateExtViewport: (viewport: Partial<Viewport>) => void;
  closeMapSearchPopUp: () => void;
  mapSettings: MapSettings;
};

const MapSearchLine = ({
  updateExtViewport,
  closeMapSearchPopUp,
  mapSettings,
}: MapSearchLineProps) => {
  const infraID = useInfraID();
  const dispatch = useAppDispatch();

  const { t } = useTranslation();
  const { updateMapSettings } = useMapSettingsActions();
  const [postSearch] = osrdEditoastApi.endpoints.postSearch.useMutation();
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [searchResults, setSearchResults] = useState<SearchResultItemTrack[]>([]);
  const [getTrackPath] =
    osrdEditoastApi.endpoints.getInfraByInfraIdLinesAndLineCodeBbox.useLazyQuery({});

  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  const searchLine = async () => {
    const searchQuery = [
      'or',
      ['search', ['line_name'], debouncedSearchTerm],
      ['like', ['to_string', ['line_code']], `%${debouncedSearchTerm}%`],
    ];
    const payload = {
      object: 'track',
      query: ['and', searchQuery, infraID !== undefined ? ['=', ['infra_id'], infraID] : true],
    };

    await postSearch({
      searchPayload: payload,
      pageSize: 101,
    })
      .unwrap()
      .then((results) => {
        setSearchResults(
          [...(results as SearchResultItemTrack[])].sort((a, b) =>
            a.line_name.localeCompare(b.line_name)
          )
        );
      })
      .catch(() => {
        setSearchResults([]);
      });
  };

  const coordinates = ({ min_lon, max_lon, min_lat, max_lat }: BoundingBox) => [
    [min_lon, min_lat],
    [max_lon, max_lat],
  ];

  const onResultClick = async (searchResultItem: SearchResultItemTrack) => {
    if (mapSettings.mapSearchMarker) {
      dispatch(updateMapSettings({ mapSearchMarker: undefined }));
    }
    await getTrackPath({ infraId: infraID!, lineCode: searchResultItem.line_code })
      .unwrap()
      .then((trackPath) => {
        const boundaries = bbox({
          type: 'LineString',
          coordinates: coordinates(trackPath),
        });
        const newViewport = computeBBoxViewport(boundaries, mapSettings.viewport);
        updateExtViewport(newViewport);
      })
      .catch(() => {
        dispatch(updateMapSettings({ lineSearchCode: undefined }));
      });
    dispatch(updateMapSettings({ lineSearchCode: searchResultItem.line_code }));
    closeMapSearchPopUp();
  };

  useEffect(() => {
    if (debouncedSearchTerm) {
      searchLine();
    } else if (searchResults.length !== 0) {
      setSearchResults([]);
    }
  }, [debouncedSearchTerm]);

  return (
    <div className="mt-2">
      <InputSNCF
        id="map-search-line"
        type="text"
        placeholder={t('mapSearch.placeholder-line')}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
          setSearchTerm(e.target.value);
        }}
        value={searchTerm}
        clearButton
        onClear={() => {
          setSearchTerm('');
          setSearchResults([]);
        }}
        sm
        focus
      />
      <h2 className="text-center mt-3">
        {searchResults.length > 100
          ? t('mapSearch.too-many-results')
          : t('mapSearch.results-count', {
              count: searchResults.length,
            })}
      </h2>
      <div className="search-results">
        {searchResults?.length > 0 &&
          searchResults.length <= 100 &&
          searchResults.map((result) => (
            <button
              className="search-result-item"
              onClick={() => onResultClick(result)}
              type="button"
              key={`line-search-item-${result.line_code}`}
            >
              <span className="name">{result.line_name}</span>
              <span className="line-code">{result.line_code}</span>
            </button>
          ))}
      </div>
    </div>
  );
};

export default MapSearchLine;
