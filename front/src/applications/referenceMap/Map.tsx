import { useCallback, useEffect, useRef, useState } from 'react';

import { isNil } from 'lodash';
import ReactMapGL, { AttributionControl, ScaleControl } from 'react-map-gl/maplibre';
import type { MapRef } from 'react-map-gl/maplibre';
import { useSelector } from 'react-redux';
import { useParams } from 'react-router-dom';

import MapButtons from 'common/Map/Buttons/MapButtons';
import { CUSTOM_ATTRIBUTION } from 'common/Map/const';
import colors from 'common/Map/Consts/colors';
import Background from 'common/Map/Layers/Background';
import { useMapBlankStyle } from 'common/Map/Layers/blankStyle';
import Hillshade from 'common/Map/Layers/Hillshade';
import IGNLayers from 'common/Map/Layers/IGNLayers';
import InfraObjectLayers from 'common/Map/Layers/InfraObjectLayers';
import LineSearchLayer from 'common/Map/Layers/LineSearchLayer';
import OSM from 'common/Map/Layers/OSM';
import PlatformsLayer from 'common/Map/Layers/Platforms';
import SearchMarker from 'common/Map/Layers/SearchMarker';
import Terrain from 'common/Map/Layers/Terrain';
import TracksOSM from 'common/Map/Layers/TracksOSM';
import { removeSearchItemMarkersOnMap } from 'common/Map/utils';
import { useInfraID } from 'common/osrdContext';
import { LAYER_GROUPS_ORDER, LAYERS } from 'config/layerOrder';
import VirtualLayers from 'modules/simulationResult/components/SimulationResultsMap/VirtualLayers';
import type { Viewport } from 'reducers/map';
import { updateViewport } from 'reducers/map';
import { getMap, getTerrain3DExaggeration } from 'reducers/map/selectors';
import { useAppDispatch } from 'store';

function Map() {
  const mapBlankStyle = useMapBlankStyle();

  const [mapLoaded, setMapLoaded] = useState(false);
  const { viewport, mapSearchMarker, mapStyle, showOSM, layersSettings } = useSelector(getMap);
  const infraID = useInfraID();
  const terrain3DExaggeration = useSelector(getTerrain3DExaggeration);
  const mapRef = useRef<MapRef | null>(null);
  const { urlLat, urlLon, urlZoom, urlBearing, urlPitch } = useParams();
  const dispatch = useAppDispatch();
  const updateViewportChange = useCallback(
    (value: Partial<Viewport>, updateRouter = false) => {
      dispatch(updateViewport(value, `/map`, updateRouter));
    },
    [dispatch]
  );

  const scaleControlStyle = {
    left: 20,
    bottom: 20,
  };

  const resetPitchBearing = () => {
    updateViewportChange({
      ...viewport,
      bearing: 0,
      pitch: 0,
    });
  };

  const defineInteractiveLayers = () => {
    const interactiveLayersLocal = [];
    if (layersSettings.tvds) {
      interactiveLayersLocal.push('chartis/osrd_tvd_section/geo');
    }
    return interactiveLayersLocal;
  };

  /**
   * When the component mount
   * => we check if url has viewport and set it in store
   */
  useEffect(() => {
    // viewport
    const newViewport: Partial<Viewport> = {};
    if (!isNil(urlLat)) newViewport.latitude = parseFloat(urlLat);
    if (!isNil(urlLon)) newViewport.longitude = parseFloat(urlLon);
    if (!isNil(urlZoom)) newViewport.zoom = parseFloat(urlZoom);
    if (!isNil(urlBearing)) newViewport.bearing = parseFloat(urlBearing);
    if (!isNil(urlPitch)) newViewport.pitch = parseFloat(urlPitch);
    if (Object.keys(newViewport).length > 0) updateViewportChange(newViewport);
    // we only do it at mount time
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="mastcontainer mastcontainer-map">
      <MapButtons
        map={mapRef.current ?? undefined}
        resetPitchBearing={resetPitchBearing}
        withInfraButton
        withMapKeyButton
        bearing={viewport.bearing}
        viewPort={viewport}
      />
      <ReactMapGL
        {...viewport}
        ref={mapRef}
        cursor="normal"
        style={{ width: '100%', height: '100%' }}
        mapStyle={mapBlankStyle}
        onMove={(e) => updateViewportChange(e.viewState)}
        onMoveEnd={(e) => updateViewportChange(e.viewState, true)}
        attributionControl={false} // Defined below
        onResize={(e) => {
          updateViewportChange({
            width: e.target.getContainer().offsetWidth,
            height: e.target.getContainer().offsetHeight,
          });
        }}
        interactiveLayerIds={defineInteractiveLayers()}
        touchZoomRotate
        maxPitch={85}
        terrain={
          terrain3DExaggeration
            ? { source: 'terrain', exaggeration: terrain3DExaggeration }
            : undefined
        }
        onLoad={() => {
          setMapLoaded(true);
        }}
        onClick={() => {
          removeSearchItemMarkersOnMap(dispatch);
        }}
      >
        <VirtualLayers />
        <AttributionControl customAttribution={CUSTOM_ATTRIBUTION} />
        <ScaleControl maxWidth={100} unit="metric" style={scaleControlStyle} />

        <Background
          colors={colors[mapStyle]}
          layerOrder={LAYER_GROUPS_ORDER[LAYERS.BACKGROUND.GROUP]}
        />
        <Terrain />

        <IGNLayers />

        {infraID && <InfraObjectLayers infraId={infraID} mapStyle={mapStyle} />}

        {!showOSM ? null : (
          <>
            <OSM
              mapStyle={mapStyle}
              layerOrder={LAYER_GROUPS_ORDER[LAYERS.BACKGROUND.GROUP]}
              mapIsLoaded={mapLoaded}
            />
            <Hillshade
              mapStyle={mapStyle}
              layerOrder={LAYER_GROUPS_ORDER[LAYERS.BACKGROUND.GROUP]}
            />
          </>
        )}

        <PlatformsLayer
          colors={colors[mapStyle]}
          layerOrder={LAYER_GROUPS_ORDER[LAYERS.PLATFORMS.GROUP]}
        />

        <TracksOSM
          colors={colors[mapStyle]}
          layerOrder={LAYER_GROUPS_ORDER[LAYERS.TRACKS_OSM.GROUP]}
        />

        <LineSearchLayer
          layerOrder={LAYER_GROUPS_ORDER[LAYERS.LINE_SEARCH.GROUP]}
          infraID={infraID}
        />

        {mapSearchMarker && <SearchMarker data={mapSearchMarker} colors={colors[mapStyle]} />}
      </ReactMapGL>
    </main>
  );
}

export default Map;
