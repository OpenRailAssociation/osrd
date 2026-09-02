import { useState } from 'react';

import { useSelector } from 'react-redux';

import type { GeoJsonLineString } from 'common/api/osrdEditoastApi';
import type { MarkerInformation } from 'common/Map/components/ItineraryMarkers';
import DefaultBaseMap from 'common/Map/DefaultBaseMap';
import { defaultMapSettings } from 'reducers/commonMap';
import type { MapSettings, Viewport } from 'reducers/commonMap/types';
import { getSearchJourneyInfraId } from 'reducers/searchJourney/selectors';

type SearchJourneyResultsMapProps = {
  geometry?: GeoJsonLineString;
  markers: MarkerInformation[];
};

/**
 * Shows the selected solution's path and stop markers (origin, destination,
 * merged intermediate stops). Uses its own local map state, like `SearchJourneyMap`.
 */
const SearchJourneyResultsMap = ({ geometry, markers }: SearchJourneyResultsMapProps) => {
  const infraId = useSelector(getSearchJourneyInfraId);

  const [mapSettings, setMapSettings] = useState<MapSettings>(defaultMapSettings);

  const updateMapSettings = (value: Partial<MapSettings>) =>
    setMapSettings((prev) => ({ ...prev, ...value }));

  const updateViewport = (viewport: Viewport) => updateMapSettings({ viewport });

  return (
    <div className="search-journey-results-map">
      <DefaultBaseMap
        mapId="search-journey-results-map"
        infraId={infraId}
        geometry={geometry}
        pathStepMarkers={markers}
        mapSettings={mapSettings}
        updateMapSettings={updateMapSettings}
        updateViewport={updateViewport}
        withToggleLayersButton={false}
      />
    </div>
  );
};

export default SearchJourneyResultsMap;
