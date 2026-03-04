import { useCallback, useMemo, useRef } from 'react';

import type { MapLibreEvent } from 'maplibre-gl';
import type { MapRef } from 'react-map-gl/maplibre';

import BaseMap from 'common/Map/BaseMap';
import MapButtons from 'common/Map/Buttons/MapButtons';
import { MapContextProvider } from 'common/Map/useMapContext';
import { useInfraID } from 'common/osrdContext';
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
