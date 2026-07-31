import { useMemo, useState } from 'react';

import { useSelector } from 'react-redux';

import DefaultBaseMap from 'common/Map/DefaultBaseMap';
import { MARKER_TYPE, type MarkerInformation } from 'common/Map/components/ItineraryMarkers';
import { defaultMapSettings } from 'reducers/commonMap';
import type { MapSettings, Viewport } from 'reducers/commonMap/types';
import type { SearchJourneyOperationalPoint } from 'reducers/searchJourney';
import {
  getSearchJourneyDestination,
  getSearchJourneyInfraId,
  getSearchJourneyOrigin,
} from 'reducers/searchJourney/selectors';

const buildMarker = (
  operationalPoint: SearchJourneyOperationalPoint,
  pointType: typeof MARKER_TYPE.ORIGIN | typeof MARKER_TYPE.DESTINATION
): MarkerInformation => ({
  id: operationalPoint.id,
  name: operationalPoint.name,
  coordinates: operationalPoint.coordinates,
  pointType,
  location: {
    type: 'operational_point_part_reference',
    operational_point: {
      type: 'domestic',
      main_code: operationalPoint.mainCode,
      country_code: operationalPoint.countryCode,
      secondary_code: operationalPoint.secondaryCode,
    },
  },
});

/**
 * Shows the origin/destination markers only, no path (no pathfinding for search
 * journey). Uses its own local map state instead of `useMapSettings`/
 * `useMapSettingsActions`, which require `OsrdContextLayout` (not used here).
 */
const SearchJourneyMap = () => {
  const infraId = useSelector(getSearchJourneyInfraId);
  const origin = useSelector(getSearchJourneyOrigin);
  const destination = useSelector(getSearchJourneyDestination);

  const [mapSettings, setMapSettings] = useState<MapSettings>(defaultMapSettings);

  const markers = useMemo(() => {
    const result: MarkerInformation[] = [];
    if (origin) result.push(buildMarker(origin, MARKER_TYPE.ORIGIN));
    if (destination) result.push(buildMarker(destination, MARKER_TYPE.DESTINATION));
    return result;
  }, [origin, destination]);

  const updateMapSettings = (value: Partial<MapSettings>) =>
    setMapSettings((prev) => ({ ...prev, ...value }));

  const updateViewport = (viewport: Viewport) => updateMapSettings({ viewport });

  return (
    <div className="search-journey-map">
      <DefaultBaseMap
        mapId="search-journey-map"
        infraId={infraId}
        pathStepMarkers={markers}
        mapSettings={mapSettings}
        updateMapSettings={updateMapSettings}
        updateViewport={updateViewport}
        withToggleLayersButton={false}
      />
    </div>
  );
};

export default SearchJourneyMap;
