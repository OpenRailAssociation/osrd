import { type PropsWithChildren, useCallback, useEffect, useRef, useState } from 'react';

import bbox from '@turf/bbox';
import { compact } from 'lodash';
import type { MapRef } from 'react-map-gl/maplibre';

import type { GeoJsonLineString } from 'common/api/osrdEditoastApi';
import BaseMap from 'common/Map/BaseMap';
import MapButtons from 'common/Map/Buttons/MapButtons';
import { computeBBoxViewport } from 'common/Map/WarpedMap/core/helpers';
import { LAYER_GROUPS_ORDER, LAYERS } from 'config/layerOrder';
import ItineraryLayer from 'modules/trainschedule/components/ManageTrainSchedule/ManageTrainScheduleMap/ItineraryLayer';
import ItineraryMarkers, {
  type MarkerInformation,
} from 'modules/trainschedule/components/ManageTrainSchedule/ManageTrainScheduleMap/ItineraryMarkers';
import { mapInitialState } from 'reducers/map';
import type { Viewport } from 'reducers/map';

type DefaultBaseMapProps = {
  mapId: string;
  infraId?: number;
  geometry?: GeoJsonLineString;
  pathStepMarkers?: MarkerInformation[];
  isFeasible?: boolean;
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
}: PropsWithChildren<DefaultBaseMapProps>) => {
  const mapRef = useRef<MapRef | null>(null);
  const [viewPort, setViewPort] = useState(mapInitialState.viewport);

  const updateViewportChange = useCallback(
    (partialViewPort: Partial<Viewport>) =>
      setViewPort((prev) => ({
        ...prev,
        ...partialViewPort,
      })),
    []
  );

  const resetPitchBearing = () => {
    updateViewportChange({
      ...viewPort,
      bearing: 0,
      pitch: 0,
    });
  };

  const zoomIn = () => {
    updateViewportChange({
      ...viewPort,
      zoom: (viewPort.zoom || ZOOM_DEFAULT) + ZOOM_DELTA,
    });
  };
  const zoomOut = () => {
    updateViewportChange({
      ...viewPort,
      zoom: (viewPort.zoom || ZOOM_DEFAULT) - ZOOM_DELTA,
    });
  };

  useEffect(() => {
    const points = geometry ?? {
      coordinates: compact(pathStepMarkers.map((step) => step.coordinates)),
      type: 'LineString',
    };
    if (points.coordinates.length >= 2) {
      const newViewport = computeBBoxViewport(bbox(points), viewPort);
      updateViewportChange(newViewport);
    }
  }, [geometry, pathStepMarkers]);

  return (
    <>
      <MapButtons
        zoomIn={zoomIn}
        zoomOut={zoomOut}
        map={mapRef.current ?? undefined}
        resetPitchBearing={resetPitchBearing}
        bearing={viewPort.bearing}
        withMapKeyButton={false}
        withSearchButton={false}
        withToggleLayersButton={false}
        viewPort={viewPort}
        isNewButtons
      />
      <BaseMap
        mapId={mapId}
        mapRef={mapRef}
        infraId={infraId}
        interactiveLayerIds={[]}
        mapStyle={mapInitialState.mapStyle}
        viewPort={viewPort}
        updatePartialViewPort={updateViewportChange}
        hideAttribution
        showOSM
      >
        <ItineraryLayer
          layerOrder={LAYER_GROUPS_ORDER[LAYERS.ITINERARY.GROUP]}
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
    </>
  );
};

export default DefaultBaseMap;
