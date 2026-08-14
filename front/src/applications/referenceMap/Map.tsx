import { useCallback, useMemo, useRef } from 'react';

import { skipToken } from '@reduxjs/toolkit/query';
import type { MapLibreEvent } from 'maplibre-gl';
import type { MapRef } from 'react-map-gl/maplibre';

import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import BaseMap from 'common/Map/BaseMap';
import MapButtons from 'common/Map/Buttons/MapButtons';
import { MapContextProvider } from 'common/Map/useMapContext';
import { computeBBoxViewport } from 'common/Map/WarpedMap/core/helpers';
import { useInfraID } from 'common/osrdContext';
import { useParams } from 'react-router-dom';
import { useMapSettings, useMapSettingsActions } from 'reducers/commonMap';
import type { MapSettings, Viewport } from 'reducers/commonMap/types';
import { syncReferenceMapRouterViewport, updateReferenceMapViewport } from 'reducers/referenceMap';
import { useAppDispatch } from 'store';

const REFERENCE_MAP_ID = 'reference-map';

const Map = () => {
  const dispatch = useAppDispatch();
  const mapSettings = useMapSettings();
  const { layersSettings, viewport } = mapSettings;
  const { updateMapSettings: updateMapSettingsAction, removeMapSearchMarker } =
    useMapSettingsActions();

  const infraID = useInfraID();

  const mapRef = useRef<MapRef | null>(null);

  const updateMapSettings = useCallback(
    (value: Partial<MapSettings>) => {
      dispatch(updateMapSettingsAction(value));
    },
    [dispatch]
  );

  const updateViewportChange = useCallback(
    (value: Partial<Viewport>) => {
      dispatch(updateReferenceMapViewport(value));
    },
    [dispatch]
  );

  const updateMapRouterViewportChange = useCallback(
    (value: MapLibreEvent) => {
      dispatch(syncReferenceMapRouterViewport(value));
    },
    [dispatch]
  );

  const resetPitchBearing = () => {
    updateViewportChange({
      bearing: 0,
      pitch: 0,
    });
  };

  const interactiveLayerIds = useMemo(
    () => (layersSettings.track_sections ? ['chartis/osrd_tvd_section/geo'] : []),
    [layersSettings.track_sections]
  );

  const { urlLat } = useParams();
  const skipNextInfraAutoFocusRef = useRef(urlLat !== undefined); 
  const { data: infraBbox } = osrdEditoastApi.endpoints.getInfraByInfraIdBbox.useQuery(
    infraID ? { infraId: infraID } : skipToken
  );
  useMemo(() => {
    if (infraBbox === undefined) return;
    if (skipNextInfraAutoFocusRef.current) {
      skipNextInfraAutoFocusRef.current = false;
      return;
    }

    const { min_lat, min_lon, max_lat, max_lon } = infraBbox!;

    const newViewport = computeBBoxViewport([min_lon, min_lat, max_lon, max_lat], viewport, {
      padding: 64,
    });

    updateViewportChange(newViewport);
  }, [infraBbox]);

  return (
    <main className="mastcontainer mastcontainer-map">
      <MapContextProvider
        infraId={infraID}
        mapSettings={mapSettings}
        updateMapSettings={updateMapSettings}
      >
        <MapButtons
          map={mapRef.current ?? undefined}
          resetPitchBearing={resetPitchBearing}
          bearing={viewport.bearing}
          viewPort={viewport}
          withInfraButton
          withMapKeyButton
        />
        <BaseMap
          mapId={REFERENCE_MAP_ID}
          mapRef={mapRef}
          cursor="normal"
          infraId={infraID}
          interactiveLayerIds={interactiveLayerIds}
          mapSettings={mapSettings}
          onClick={() => {
            dispatch(removeMapSearchMarker());
          }}
          onIdleRouterSync={updateMapRouterViewportChange}
          updatePartialViewPort={updateViewportChange}
        />
      </MapContextProvider>
    </main>
  );
};

export default Map;
