import { Fragment, type PropsWithChildren, useCallback, useEffect, useRef } from 'react';

import bbox from '@turf/bbox';
import type { Geometry } from 'geojson';
import { compact } from 'lodash';
import type { MapRef } from 'react-map-gl/maplibre';

import type { GeoJsonMultiLineString } from 'common/api/osrdEditoastApi';
import BaseMap from 'common/Map/BaseMap';
import MapButtons from 'common/Map/Buttons/MapButtons';
import ItineraryLayer from 'common/Map/components/ItineraryLayer';
import { type MarkerInformation } from 'common/Map/components/ItineraryMarkers';
import { computeBBoxViewport } from 'common/Map/WarpedMap/core/helpers';
import { LAYER_GROUPS_ORDER, LAYERS } from 'config/layerOrder';
import type { MapSettings, Viewport } from 'reducers/commonMap/types';

import PathStepMarker, { PATH_STEP_MARKER_STATE } from './components/PathStepMarker';
import { MapContextProvider } from './useMapContext';

type DefaultBaseMapProps = {
  mapId: string;
  infraId?: number;
  geometry?: GeoJsonMultiLineString;
  pathStepMarkers?: MarkerInformation[];
  isFeasible?: boolean;
  mapSettings: MapSettings;
  updateMapSettings: (mapSettings: Partial<MapSettings>) => void;
  updateViewport: (viewPort: Viewport) => void;
  highlightedArea?: Geometry;
  highlightedOperationalPoints?: number[];
  highlightedTrackSections?: string[];
  withToggleLayersButton?: boolean;
};

const ZOOM_DEFAULT = 5;
const ZOOM_DELTA = 1.5;

const NO_PATH_STEP_MARKERS: MarkerInformation[] = [];

/**
 * Default base map used to display a path and some markers.
 * No interactions are available, except zoom in/out, pan and reset pitch/bearing.
 */
const DefaultBaseMap = ({
  mapId,
  infraId,
  geometry,
  pathStepMarkers = NO_PATH_STEP_MARKERS,
  isFeasible = true,
  children,
  mapSettings,
  updateMapSettings,
  updateViewport,
  highlightedArea,
  highlightedOperationalPoints,
  highlightedTrackSections,
  withToggleLayersButton,
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
    // The markers are taken into account too: when only a part of the path could be
    // computed, the geometry alone doesn't cover all the requested path steps.
    const points = {
      coordinates: [
        ...(geometry?.coordinates.flat() ?? []),
        ...compact(pathStepMarkers.map((step) => step.coordinates)),
      ],
      type: 'LineString' as const,
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
        withToggleLayersButton={withToggleLayersButton}
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

        {pathStepMarkers?.map((marker, index) => (
          <Fragment key={marker.id}>
            {marker.coordinates ? (
              <PathStepMarker
                id={marker.id}
                testId={`${mapId}-marker-${marker.pointType}`}
                coordinates={marker.coordinates}
                markerIndicator={`${index + 1}`}
                name={marker.name}
                markerState={marker.isBackTrack ? PATH_STEP_MARKER_STATE.REVERSE : undefined}
                isBackTrack={marker.isBackTrack}
              />
            ) : null}
          </Fragment>
        ))}
        {children}
      </BaseMap>
    </MapContextProvider>
  );
};

export default DefaultBaseMap;
