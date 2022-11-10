import { isNil } from 'lodash';
import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import ReactMapGL, {
  AttributionControl,
  FlyToInterpolator,
  ScaleControl,
  MapEvent,
} from 'react-map-gl';
import { useDispatch, useSelector } from 'react-redux';

import { updateViewport, Viewport } from 'reducers/map';
import { RootState } from 'reducers';

import { LAYER_GROUPS_ORDER, LAYERS } from 'config/layerOrder';

/* Main data & layers */
import Background from 'common/Map/Layers/Background';
import BufferStops from 'common/Map/Layers/BufferStops';
/* Settings & Buttons */
import MapButtons from 'common/Map/Buttons/MapButtons';
import Detectors from 'common/Map/Layers/Detectors';
import Catenaries from 'common/Map/Layers/Catenaries';
import Hillshade from 'common/Map/Layers/Hillshade';
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

import 'common/Map/Map.scss';

function Map() {
  const { viewport, mapSearchMarker, mapStyle, mapTrackSources, showOSM, layersSettings } =
    useSelector((state: RootState) => state.map);
  const [idHover, setIdHover] = useState<string | undefined>(undefined);
  const { urlLat, urlLon, urlZoom, urlBearing, urlPitch } = useParams();
  const { fullscreen } = useSelector((state: RootState) => state.main);
  const dispatch = useDispatch();
  const updateViewportChange = useCallback(
    (value) => dispatch(updateViewport(value, '/carto')),
    [dispatch]
  );

  const scaleControlStyle = {
    left: 20,
    bottom: 20,
  };

  const resetPitchBearing = () => {
    updateViewportChange({
      ...viewport,
      bearing: parseFloat('0'),
      pitch: parseFloat('0'),
      transitionDuration: 1000,
      transitionInterpolator: new FlyToInterpolator(),
    });
  };

  const onFeatureClick = (e: MapEvent) => {
    console.log(e);
  };

  const onFeatureHover = (e: MapEvent) => {
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

  useEffect(() => {
    const newViewport: Partial<Viewport> = {};
    if (!isNil(urlLat)) newViewport.latitude = parseFloat(urlLat);
    if (!isNil(urlLon)) newViewport.longitude = parseFloat(urlLon);
    if (!isNil(urlZoom)) newViewport.zoom = parseFloat(urlZoom);
    if (!isNil(urlBearing)) newViewport.bearing = parseFloat(urlBearing);
    if (!isNil(urlPitch)) newViewport.pitch = parseFloat(urlPitch);
    if (Object.keys(newViewport).length > 0) updateViewportChange(newViewport);
  }, []);

  return (
    <main className={`mastcontainer mastcontainer-map${fullscreen ? ' fullscreen' : ''}`}>
      <MapButtons resetPitchBearing={resetPitchBearing} />
      <ReactMapGL
        {...viewport}
        style={{ cursor: 'normal' }}
        width="100%"
        height="100%"
        mapStyle={osmBlankStyle}
        onViewportChange={updateViewportChange}
        clickRadius={4}
        attributionControl={false} // Defined below
        onClick={onFeatureClick}
        onHover={onFeatureHover}
        interactiveLayerIds={defineInteractiveLayers()}
        touchRotate
        asyncRender
      >
        <AttributionControl
          className="attribution-control"
          customAttribution="©SNCF/DGEX Solutions"
        />
        <ScaleControl maxWidth={100} unit="metric" style={scaleControlStyle} />

        <Background
          colors={colors[mapStyle]}
          layerOrder={LAYER_GROUPS_ORDER[LAYERS.BACKGROUND.GROUP]}
        />

        {!showOSM ? null : (
          <>
            <OSM mapStyle={mapStyle} layerOrder={LAYER_GROUPS_ORDER[LAYERS.BACKGROUND.GROUP]} />
            <Hillshade
              mapStyle={mapStyle}
              layerOrder={LAYER_GROUPS_ORDER[LAYERS.BACKGROUND.GROUP]}
            />
          </>
        )}

        {/* Have to duplicate objects with sourceLayer to avoid cache problems in mapbox */}
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
            />

            <Signals
              sourceTable="signals"
              colors={colors[mapStyle]}
              sourceLayer="geo"
              layerOrder={LAYER_GROUPS_ORDER[LAYERS.SIGNALS.GROUP]}
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
            <SNCF_LPV geomType="sch" colors={colors[mapStyle]} />

            <Signals
              sourceTable="signals"
              colors={colors[mapStyle]}
              sourceLayer="sch"
              layerOrder={LAYER_GROUPS_ORDER[LAYERS.SIGNALS.GROUP]}
            />
          </>
        )}

        {mapSearchMarker !== undefined ? (
          <SearchMarker data={mapSearchMarker} colors={colors[mapStyle]} />
        ) : null}
      </ReactMapGL>
    </main>
  );
}

export default Map;
