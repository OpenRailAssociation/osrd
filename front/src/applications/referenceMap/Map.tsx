import { useCallback, useMemo, useRef } from 'react';

import type { MapRef } from 'react-map-gl/maplibre';
import { useSelector } from 'react-redux';

import BaseMap from 'common/Map/BaseMap';
import MapButtons from 'common/Map/Buttons/MapButtons';
import { removeSearchItemMarkersOnMap } from 'common/Map/utils';
import { useInfraID } from 'common/osrdContext';
import type { Viewport } from 'reducers/map';
import { updateViewport } from 'reducers/map';
import { getMap, getTerrain3DExaggeration } from 'reducers/map/selectors';
import { useAppDispatch } from 'store';

const REFERENCE_MAP_ID = 'reference-map';

const Map = () => {
  const dispatch = useAppDispatch();
  const { viewport, mapSearchMarker, mapStyle, showOSM, layersSettings } = useSelector(getMap);
  const infraID = useInfraID();
  const terrain3DExaggeration = useSelector(getTerrain3DExaggeration);

  const mapRef = useRef<MapRef | null>(null);

  const updateViewportChange = useCallback(
    (value: Partial<Viewport>, { updateRouter } = { updateRouter: false }) => {
      dispatch(updateViewport(value, `/map`, updateRouter));
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
    () => (layersSettings.tvds ? ['chartis/osrd_tvd_section/geo'] : []),
    [layersSettings]
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
      />
      <BaseMap
        mapId={REFERENCE_MAP_ID}
        mapRef={mapRef}
        cursor="normal"
        infraId={infraID}
        interactiveLayerIds={interactiveLayerIds}
        mapSearchMarker={mapSearchMarker}
        mapStyle={mapStyle}
        onClick={() => {
          removeSearchItemMarkersOnMap(dispatch);
        }}
        showOSM={showOSM}
        viewPort={viewport}
        updatePartialViewPort={updateViewportChange}
        terrain3DExaggeration={terrain3DExaggeration}
      />
    </main>
  );
};

export default Map;
