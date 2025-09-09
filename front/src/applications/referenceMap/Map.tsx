import { useCallback, useMemo, useRef } from 'react';

import type { MapRef } from 'react-map-gl/maplibre';

import BaseMap from 'common/Map/BaseMap';
import MapButtons from 'common/Map/Buttons/MapButtons';
import { useInfraID } from 'common/osrdContext';
import { useMapSettings, useMapSettingsActions } from 'reducers/commonMap';
import type { Viewport } from 'reducers/commonMap/types';
import { updateReferenceMapViewport } from 'reducers/referenceMap';
import { useAppDispatch } from 'store';

const REFERENCE_MAP_ID = 'reference-map';

const Map = () => {
  const dispatch = useAppDispatch();
  const mapSettings = useMapSettings();
  const { layersSettings, viewport } = mapSettings;
  const { removeMapSearchMarker } = useMapSettingsActions();

  const infraID = useInfraID();

  const mapRef = useRef<MapRef | null>(null);

  const updateViewportChange = useCallback(
    (value: Partial<Viewport>, { updateRouter } = { updateRouter: false }) => {
      dispatch(updateReferenceMapViewport(value, updateRouter));
    },
    []
  );

  const resetPitchBearing = () => {
    updateViewportChange({
      bearing: 0,
      pitch: 0,
    });
  };

  const interactiveLayerIds = useMemo(
    () => (layersSettings.tvds ? ['chartis/osrd_tvd_section/geo'] : []),
    [layersSettings.tvds]
  );

  return (
    <main className="mastcontainer mastcontainer-map">
      <MapButtons
        map={mapRef.current ?? undefined}
        resetPitchBearing={resetPitchBearing}
        bearing={viewport.bearing}
        viewPort={viewport}
        withInfraButton
        withMapKeyButton
        mapSettings={mapSettings}
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
        updatePartialViewPort={updateViewportChange}
      />
    </main>
  );
};

export default Map;
