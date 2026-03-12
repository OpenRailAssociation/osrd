import { type PropsWithChildren, useCallback, useEffect, useRef } from 'react';

import bbox from '@turf/bbox';
import type { Geometry } from 'geojson';
import { compact } from 'lodash';
import type { MapRef } from 'react-map-gl/maplibre';

import type { GeoJsonLineString } from 'common/api/osrdEditoastApi';
import BaseMap from 'common/Map/BaseMap';
import MapButtons from 'common/Map/Buttons/MapButtons';
import ItineraryLayer from 'common/Map/components/ItineraryLayer';
import ItineraryMarkers, { type MarkerInformation } from 'common/Map/components/ItineraryMarkers';
import { computeBBoxViewport } from 'common/Map/WarpedMap/core/helpers';
import { LAYER_GROUPS_ORDER, LAYERS } from 'config/layerOrder';
import type { MapSettings, Viewport } from 'reducers/commonMap/types';

import { MapContextProvider } from './useMapContext';

type DefaultBaseMapProps = {
  mapId: string;
  infraId?: number;
  geometry?: GeoJsonLineString;
  pathStepMarkers?: MarkerInformation[];
  isFeasible?: boolean;
  mapSettings: MapSettings;
  updateMapSettings: (mapSettings: Partial<MapSettings>) => void;
  updateViewport: (viewPort: Viewport) => void;
  highlightedArea?: Geometry;
  highlightedOperationalPoints?: number[];
  highlightedTrackSections?: string[];
};

const ZOOM_DEFAULT = 5;
const ZOOM_DELTA = 1.5;

/**
 * Default base map used to display a path and some markers.
 * No interactions are available, except zoom in/out, pan and reset pitch/bearing.
 */
const DefaultBaseMap = ({
  mapId,
  infraId,
  geometry,
  pathStepMarkers = [],
  isFeasible = true,
  children,
  mapSettings,
  updateMapSettings,
  updateViewport,
  highlightedArea,
  highlightedOperationalPoints,
  highlightedTrackSections,
}: PropsWithChildren<DefaultBaseMapProps>) => {
  const mapRef = useRef<MapRef | null>(null);
  const { viewport } = mapSettings;

  const updateViewportChange = useCallback(
    (partialViewPort: Partial<Viewport>) => {
      updateViewport({ ...viewport, ...partialViewPort });
    },
    [updateViewport, viewport]
  );
  const resetPitchBearing = () => {
    updateViewportChange({
      ...viewport,
      bearing: 0,
      pitch: 0,
    });
  };

  const zoomIn = () => {
    updateViewportChange({
      ...viewport,
      zoom: (viewport.zoom || ZOOM_DEFAULT) + ZOOM_DELTA,
    });
  };
  const zoomOut = () => {
    updateViewportChange({
      ...viewport,
      zoom: (viewport.zoom || ZOOM_DEFAULT) - ZOOM_DELTA,
    });
  };

  useEffect(() => {
    const points = geometry ?? {
      coordinates: compact(pathStepMarkers.map((step) => step.coordinates)),
      type: 'LineString',
    };
    if (points.coordinates.length >= 2) {
      const newViewport = computeBBoxViewport(bbox(points), viewport);
      updateViewportChange(newViewport);
    }
  }, [geometry, pathStepMarkers]);

  return (
    <MapContextProvider
      infraId={infraId}
      mapSettings={mapSettings}
      updateMapSettings={updateMapSettings}
      highlightedTrackSections={highlightedTrackSections}
      highlightedOperationalPoints={highlightedOperationalPoints}
    >
      <MapButtons
        zoomIn={zoomIn}
        zoomOut={zoomOut}
        map={mapRef.current ?? undefined}
        resetPitchBearing={resetPitchBearing}
        bearing={viewport.bearing}
        withMapKeyButton={false}
        withSearchButton={false}
        viewPort={viewport}
        isNewButtons
        compactModal
      />
      <BaseMap
        mapId={mapId}
        mapRef={mapRef}
        infraId={infraId}
        interactiveLayerIds={[]}
        updatePartialViewPort={updateViewportChange}
        hideAttribution
        mapSettings={mapSettings}
        highlightedArea={highlightedArea}
      >
        <ItineraryLayer
          layerOrder={LAYER_GROUPS_ORDER[LAYERS.PATH.GROUP]}
          geometry={geometry}
          isFeasible={isFeasible}
          showStdcmAssets
        />
        {infraId && (
          <ItineraryMarkers
            infraId={infraId}
            simulationPathSteps={pathStepMarkers}
            showStdcmAssets
          />
        )}

        {children}
      </BaseMap>
    </MapContextProvider>
  );
};

export default DefaultBaseMap;
