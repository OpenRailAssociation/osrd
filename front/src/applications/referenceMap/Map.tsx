import { isNil } from 'lodash';
import React, { useCallback, useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import ReactMapGL, { AttributionControl, ScaleControl, MapRef } from 'react-map-gl/maplibre';
import { useDispatch, useSelector } from 'react-redux';
import { updateViewport, Viewport } from 'reducers/map';
import { RootState } from 'reducers';
import { MapLayerMouseEvent } from 'maplibre-gl';

import { LAYER_GROUPS_ORDER, LAYERS } from 'config/layerOrder';
import { getTerrain3DExaggeration } from 'reducers/map/selectors';

/* Main data & layers */
import Background from 'common/Map/Layers/Background';
import Terrain from 'common/Map/Layers/Terrain';
import VirtualLayers from 'modules/simulationResult/components/SimulationResultsMap/VirtualLayers';
import BufferStops from 'common/Map/Layers/BufferStops';
/* Settings & Buttons */
import MapButtons from 'common/Map/Buttons/MapButtons';
import Detectors from 'common/Map/Layers/Detectors';
import Catenaries from 'common/Map/Layers/Catenaries';
import NeutralSections from 'common/Map/Layers/NeutralSections';
import Hillshade from 'common/Map/Layers/Hillshade';
import IGN_BD_ORTHO from 'common/Map/Layers/IGN_BD_ORTHO';
import IGN_SCAN25 from 'common/Map/Layers/IGN_SCAN25';
import IGN_CADASTRE from 'common/Map/Layers/IGN_CADASTRE';
import OSM from 'common/Map/Layers/OSM';
/* Objects & various */
import OperationalPoints from 'common/Map/Layers/OperationalPoints';
import Platforms from 'common/Map/Layers/Platforms';
import Routes from 'common/Map/Layers/Routes';
import SearchMarker from 'common/Map/Layers/SearchMarker';
import Signals from 'common/Map/Layers/Signals';
import SpeedLimits from 'common/Map/Layers/SpeedLimits';
import SNCF_LPV from 'common/Map/Layers/extensions/SNCF/SNCF_LPV';
import Switches from 'common/Map/Layers/Switches';
import TracksGeographic from 'common/Map/Layers/TracksGeographic';
import TracksOSM from 'common/Map/Layers/TracksOSM';
import TracksSchematic from 'common/Map/Layers/TracksSchematic';
import colors from 'common/Map/Consts/colors';
import osmBlankStyle from 'common/Map/Layers/osmBlankStyle';
import { CUSTOM_ATTRIBUTION } from 'common/Map/const';
import LineSearchLayer from 'common/Map/Layers/LineSearchLayer';

import 'common/Map/Map.scss';

function Map() {
  const { viewport, mapSearchMarker, mapStyle, mapTrackSources, showOSM, layersSettings } =
    useSelector((state: RootState) => state.map);
  const terrain3DExaggeration = useSelector(getTerrain3DExaggeration);
  const mapRef = useRef<MapRef | null>(null);
  const [idHover, setIdHover] = useState<string | undefined>(undefined);
  const { urlLat, urlLon, urlZoom, urlBearing, urlPitch } = useParams();
  const { fullscreen } = useSelector((state: RootState) => state.main);
  const dispatch = useDispatch();
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

  const onFeatureHover = (e: MapLayerMouseEvent) => {
    if (e.features && e.features[0] !== undefined && e.features[0].properties) {
      setIdHover(e.features[0].properties.id);
    } else {
      setIdHover(undefined);
    }
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
    <main className={`mastcontainer mastcontainer-map${fullscreen ? ' fullscreen' : ''}`}>
      <MapButtons
        map={mapRef.current ?? undefined}
        resetPitchBearing={resetPitchBearing}
        withInfraButton
        withFullscreenButton
      />
      <ReactMapGL
        {...viewport}
        ref={mapRef}
        cursor="normal"
        style={{ width: '100%', height: '100%' }}
        mapStyle={osmBlankStyle}
        onMove={(e) => updateViewportChange(e.viewState)}
        onMoveEnd={(e) => updateViewportChange(e.viewState, true)}
        attributionControl={false} // Defined below
        onResize={(e) => {
          updateViewportChange({
            width: e.target.getContainer().offsetWidth,
            height: e.target.getContainer().offsetHeight,
          });
        }}
        onMouseOver={onFeatureHover}
        interactiveLayerIds={defineInteractiveLayers()}
        touchZoomRotate
        maxPitch={85}
        terrain={{ source: 'terrain', exaggeration: terrain3DExaggeration }}
      >
        <VirtualLayers />
        <AttributionControl customAttribution={CUSTOM_ATTRIBUTION} />
        <ScaleControl maxWidth={100} unit="metric" style={scaleControlStyle} />

        <Background
          colors={colors[mapStyle]}
          layerOrder={LAYER_GROUPS_ORDER[LAYERS.BACKGROUND.GROUP]}
        />
        <Terrain />

        <IGN_BD_ORTHO layerOrder={LAYER_GROUPS_ORDER[LAYERS.BACKGROUND.GROUP]} />
        <IGN_SCAN25 layerOrder={LAYER_GROUPS_ORDER[LAYERS.BACKGROUND.GROUP]} />
        <IGN_CADASTRE layerOrder={LAYER_GROUPS_ORDER[LAYERS.BACKGROUND.GROUP]} />

        {!showOSM ? null : (
          <>
            <OSM mapStyle={mapStyle} layerOrder={LAYER_GROUPS_ORDER[LAYERS.BACKGROUND.GROUP]} />
            <Hillshade
              mapStyle={mapStyle}
              layerOrder={LAYER_GROUPS_ORDER[LAYERS.BACKGROUND.GROUP]}
              display={terrain3DExaggeration > 0}
            />
          </>
        )}

        {/* Have to duplicate objects with sourceLayer to avoid cache problems */}
        {mapTrackSources === 'geographic' ? (
          <>
            <Platforms
              colors={colors[mapStyle]}
              layerOrder={LAYER_GROUPS_ORDER[LAYERS.PLATFORMS.GROUP]}
            />

            <TracksGeographic
              colors={colors[mapStyle]}
              layerOrder={LAYER_GROUPS_ORDER[LAYERS.TRACKS_GEOGRAPHIC.GROUP]}
            />
            <TracksOSM
              colors={colors[mapStyle]}
              layerOrder={LAYER_GROUPS_ORDER[LAYERS.TRACKS_OSM.GROUP]}
            />

            <Routes
              geomType="geo"
              colors={colors[mapStyle]}
              layerOrder={LAYER_GROUPS_ORDER[LAYERS.ROUTES.GROUP]}
            />
            <OperationalPoints
              geomType="geo"
              colors={colors[mapStyle]}
              layerOrder={LAYER_GROUPS_ORDER[LAYERS.OPERATIONAL_POINTS.GROUP]}
            />
            <Catenaries
              geomType="geo"
              colors={colors[mapStyle]}
              layerOrder={LAYER_GROUPS_ORDER[LAYERS.CATENARIES.GROUP]}
            />
            <NeutralSections
              geomType="geo"
              layerOrder={LAYER_GROUPS_ORDER[LAYERS.DEAD_SECTIONS.GROUP]}
            />
            <BufferStops
              geomType="geo"
              colors={colors[mapStyle]}
              layerOrder={LAYER_GROUPS_ORDER[LAYERS.BUFFER_STOPS.GROUP]}
            />
            <Detectors
              geomType="geo"
              colors={colors[mapStyle]}
              layerOrder={LAYER_GROUPS_ORDER[LAYERS.DETECTORS.GROUP]}
            />
            <Switches
              geomType="geo"
              colors={colors[mapStyle]}
              layerOrder={LAYER_GROUPS_ORDER[LAYERS.SWITCHES.GROUP]}
            />

            <SpeedLimits
              geomType="geo"
              colors={colors[mapStyle]}
              layerOrder={LAYER_GROUPS_ORDER[LAYERS.SPEED_LIMITS.GROUP]}
            />
            <SNCF_LPV
              geomType="geo"
              colors={colors[mapStyle]}
              layerOrder={LAYER_GROUPS_ORDER[LAYERS.SPEED_LIMITS.GROUP]}
            />

            <Signals
              sourceTable="signals"
              colors={colors[mapStyle]}
              sourceLayer="geo"
              layerOrder={LAYER_GROUPS_ORDER[LAYERS.SIGNALS.GROUP]}
            />
            <LineSearchLayer
              geomType="geo"
              layerOrder={LAYER_GROUPS_ORDER[LAYERS.LINE_SEARCH.GROUP]}
            />
          </>
        ) : (
          <>
            <TracksSchematic
              colors={colors[mapStyle]}
              idHover={idHover}
              layerOrder={LAYER_GROUPS_ORDER[LAYERS.TRACKS_SCHEMATIC.GROUP]}
            />

            <Routes
              geomType="sch"
              colors={colors[mapStyle]}
              layerOrder={LAYER_GROUPS_ORDER[LAYERS.ROUTES.GROUP]}
            />
            <OperationalPoints
              geomType="sch"
              colors={colors[mapStyle]}
              layerOrder={LAYER_GROUPS_ORDER[LAYERS.OPERATIONAL_POINTS.GROUP]}
            />
            <Catenaries
              geomType="sch"
              colors={colors[mapStyle]}
              layerOrder={LAYER_GROUPS_ORDER[LAYERS.CATENARIES.GROUP]}
            />
            <NeutralSections
              geomType="sch"
              layerOrder={LAYER_GROUPS_ORDER[LAYERS.DEAD_SECTIONS.GROUP]}
            />
            <BufferStops
              geomType="sch"
              colors={colors[mapStyle]}
              layerOrder={LAYER_GROUPS_ORDER[LAYERS.BUFFER_STOPS.GROUP]}
            />
            <Detectors
              geomType="sch"
              colors={colors[mapStyle]}
              layerOrder={LAYER_GROUPS_ORDER[LAYERS.DETECTORS.GROUP]}
            />
            <Switches
              geomType="sch"
              colors={colors[mapStyle]}
              layerOrder={LAYER_GROUPS_ORDER[LAYERS.SWITCHES.GROUP]}
            />

            <SpeedLimits
              geomType="sch"
              colors={colors[mapStyle]}
              layerOrder={LAYER_GROUPS_ORDER[LAYERS.SPEED_LIMITS.GROUP]}
            />
            <SNCF_LPV
              geomType="sch"
              colors={colors[mapStyle]}
              layerOrder={LAYER_GROUPS_ORDER[LAYERS.SPEED_LIMITS.GROUP]}
            />

            <Signals
              sourceTable="signals"
              colors={colors[mapStyle]}
              sourceLayer="sch"
              layerOrder={LAYER_GROUPS_ORDER[LAYERS.SIGNALS.GROUP]}
            />
            <LineSearchLayer
              geomType="sch"
              layerOrder={LAYER_GROUPS_ORDER[LAYERS.LINE_SEARCH.GROUP]}
            />
          </>
        )}

        {mapSearchMarker !== undefined && (
          <SearchMarker data={mapSearchMarker} colors={colors[mapStyle]} />
        )}
      </ReactMapGL>
    </main>
  );
}

export default Map;
