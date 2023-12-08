import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MapLayerMouseEvent } from 'maplibre-gl';
import ReactMapGL, { AttributionControl, ScaleControl, MapRef } from 'react-map-gl/maplibre';
import { useDispatch, useSelector } from 'react-redux';
import { NearestPointOnLine } from '@turf/nearest-point-on-line';
import { useParams } from 'react-router-dom';
import { RootState } from 'reducers';
import { updateFeatureInfoClickOSRD } from 'reducers/osrdconf';
import { updateViewport, Viewport } from 'reducers/map';
/* Main data & layers */
import Background from 'common/Map/Layers/Background';
import VirtualLayers from 'modules/simulationResult/components/SimulationResultsMap/VirtualLayers';
/* Settings & Buttons */
import MapButtons from 'common/Map/Buttons/MapButtons';
import Catenaries from 'common/Map/Layers/Catenaries';
import NeutralSections from 'common/Map/Layers/NeutralSections';
import Hillshade from 'common/Map/Layers/Hillshade';
import OSM from 'common/Map/Layers/OSM';
import OperationalPoints from 'common/Map/Layers/OperationalPoints';
import PlatformsLayer from 'common/Map/Layers/Platforms';
import Itinerary from 'modules/trainschedule/components/ManageTrainSchedule/ManageTrainScheduleMap/Itinerary';
import ItineraryMarkers from 'modules/trainschedule/components/ManageTrainSchedule/ManageTrainScheduleMap/ItineraryMarkers';
/* Interactions */
import RenderPopup from 'modules/trainschedule/components/ManageTrainSchedule/ManageTrainScheduleMap/RenderPopup';
import Routes from 'common/Map/Layers/Routes';
import SearchMarker from 'common/Map/Layers/SearchMarker';
import Signals from 'common/Map/Layers/Signals';
import SnappedMarker from 'common/Map/Layers/SnappedMarker';
import SpeedLimits from 'common/Map/Layers/SpeedLimits';
import BufferStops from 'common/Map/Layers/BufferStops';
import Detectors from 'common/Map/Layers/Detectors';
import Switches from 'common/Map/Layers/Switches';
import TracksOSM from 'common/Map/Layers/TracksOSM';
/* Objects & various */
import TracksGeographic from 'common/Map/Layers/TracksGeographic';
import colors from 'common/Map/Consts/colors';
import { useMapBlankStyle } from 'common/Map/Layers/blankStyle';
import { LAYER_GROUPS_ORDER, LAYERS } from 'config/layerOrder';
import 'common/Map/Map.scss';
import SNCF_PSL from 'common/Map/Layers/extensions/SNCF/PSL';
import IGN_BD_ORTHO from 'common/Map/Layers/IGN_BD_ORTHO';
import IGN_SCAN25 from 'common/Map/Layers/IGN_SCAN25';
import IGN_CADASTRE from 'common/Map/Layers/IGN_CADASTRE';
import { CUSTOM_ATTRIBUTION } from 'common/Map/const';
import LineSearchLayer from 'common/Map/Layers/LineSearchLayer';
import Terrain from 'common/Map/Layers/Terrain';
import { getTerrain3DExaggeration } from 'reducers/map/selectors';
import { getMapMouseEventNearestFeature } from 'utils/mapHelper';

const Map = () => {
  const { viewport, mapSearchMarker, mapStyle, showOSM, layersSettings } = useSelector(
    (state: RootState) => state.map
  );
  const terrain3DExaggeration = useSelector(getTerrain3DExaggeration);
  const mapBlankStyle = useMapBlankStyle();
  const [snappedPoint, setSnappedPoint] = useState<NearestPointOnLine>();
  const { urlLat = '', urlLon = '', urlZoom = '', urlBearing = '', urlPitch = '' } = useParams();
  const dispatch = useDispatch();
  const updateViewportChange = useCallback(
    (value: Partial<Viewport>) => dispatch(updateViewport(value, undefined)),
    [dispatch]
  );

  const [mapIsLoaded, setMapIsLoaded] = useState(false);

  const mapRef = useRef<MapRef | null>(null);

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

  const onFeatureClick = (e: MapLayerMouseEvent) => {
    const result = getMapMouseEventNearestFeature(e, { layersId: ['chartis/tracks-geo/main'] });
    if (
      result &&
      result.feature.properties &&
      result.feature.properties.id &&
      result.feature.geometry.type === 'LineString'
    ) {
      dispatch(
        updateFeatureInfoClickOSRD({
          displayPopup: true,
          feature: result.feature,
          coordinates: result.nearest,
        })
      );
    } else {
      dispatch(
        updateFeatureInfoClickOSRD({
          displayPopup: false,
          feature: undefined,
        })
      );
    }
  };

  const onMoveGetFeature = (e: MapLayerMouseEvent) => {
    const result = getMapMouseEventNearestFeature(e, { layersId: ['chartis/tracks-geo/main'] });
    if (
      result &&
      result.feature.properties &&
      result.feature.properties.id &&
      result.feature.geometry.type === 'LineString'
    ) {
      setSnappedPoint({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: result.nearest,
        },
        properties: {
          distance: result.distance,
        },
      });
    } else {
      setSnappedPoint(undefined);
    }
  };

  const interactiveLayerIds = useMemo(() => {
    const result: Array<string> = [];
    result.push('chartis/tracks-geo/main');
    if (layersSettings.operationalpoints) {
      result.push('chartis/osrd_operational_point/geo');
    }
    if (layersSettings.tvds) {
      result.push('chartis/osrd_tvd_section/geo');
    }
    return result;
  }, [layersSettings]);

  useEffect(() => {
    if (urlLat) {
      updateViewportChange({
        ...viewport,
        latitude: parseFloat(urlLat),
        longitude: parseFloat(urlLon),
        zoom: parseFloat(urlZoom),
        bearing: parseFloat(urlBearing),
        pitch: parseFloat(urlPitch),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <MapButtons map={mapRef.current ?? undefined} resetPitchBearing={resetPitchBearing} />
      <ReactMapGL
        ref={mapRef}
        {...viewport}
        style={{ width: '100%', height: '100%' }}
        cursor="pointer"
        mapStyle={mapBlankStyle}
        onMove={(e) => updateViewportChange(e.viewState)}
        onMouseMove={onMoveGetFeature}
        attributionControl={false} // Defined below
        onClick={onFeatureClick}
        onResize={(e) => {
          updateViewportChange({
            width: e.target.getContainer().offsetWidth,
            height: e.target.getContainer().offsetHeight,
          });
        }}
        interactiveLayerIds={interactiveLayerIds}
        touchZoomRotate
        maxPitch={85}
        terrain={
          terrain3DExaggeration
            ? { source: 'terrain', exaggeration: terrain3DExaggeration }
            : undefined
        }
        onLoad={() => {
          setMapIsLoaded(true);
        }}
      >
        <VirtualLayers />
        <AttributionControl position="bottom-right" customAttribution={CUSTOM_ATTRIBUTION} />
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
            <OSM
              mapStyle={mapStyle}
              layerOrder={LAYER_GROUPS_ORDER[LAYERS.BACKGROUND.GROUP]}
              mapIsLoaded={mapIsLoaded}
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

        <TracksGeographic
          colors={colors[mapStyle]}
          layerOrder={LAYER_GROUPS_ORDER[LAYERS.TRACKS_GEOGRAPHIC.GROUP]}
        />
        <TracksOSM
          colors={colors[mapStyle]}
          layerOrder={LAYER_GROUPS_ORDER[LAYERS.TRACKS_OSM.GROUP]}
        />

        <Routes colors={colors[mapStyle]} layerOrder={LAYER_GROUPS_ORDER[LAYERS.ROUTES.GROUP]} />
        <OperationalPoints
          colors={colors[mapStyle]}
          layerOrder={LAYER_GROUPS_ORDER[LAYERS.OPERATIONAL_POINTS.GROUP]}
        />
        <Catenaries
          colors={colors[mapStyle]}
          layerOrder={LAYER_GROUPS_ORDER[LAYERS.CATENARIES.GROUP]}
        />
        <NeutralSections layerOrder={LAYER_GROUPS_ORDER[LAYERS.DEAD_SECTIONS.GROUP]} />
        <BufferStops
          colors={colors[mapStyle]}
          layerOrder={LAYER_GROUPS_ORDER[LAYERS.BUFFER_STOPS.GROUP]}
        />
        <Detectors
          colors={colors[mapStyle]}
          layerOrder={LAYER_GROUPS_ORDER[LAYERS.DETECTORS.GROUP]}
        />
        <Switches
          colors={colors[mapStyle]}
          layerOrder={LAYER_GROUPS_ORDER[LAYERS.SWITCHES.GROUP]}
        />

        <SpeedLimits
          colors={colors[mapStyle]}
          layerOrder={LAYER_GROUPS_ORDER[LAYERS.SPEED_LIMITS.GROUP]}
        />
        <SNCF_PSL
          colors={colors[mapStyle]}
          layerOrder={LAYER_GROUPS_ORDER[LAYERS.SPEED_LIMITS.GROUP]}
        />

        <Signals
          sourceTable="signals"
          colors={colors[mapStyle]}
          layerOrder={LAYER_GROUPS_ORDER[LAYERS.SIGNALS.GROUP]}
        />
        <LineSearchLayer layerOrder={LAYER_GROUPS_ORDER[LAYERS.LINE_SEARCH.GROUP]} />

        <RenderPopup />
        {mapIsLoaded && (
          <>
            <Itinerary layerOrder={LAYER_GROUPS_ORDER[LAYERS.ITINERARY.GROUP]} />
            {mapRef.current && <ItineraryMarkers map={mapRef.current.getMap()} />}
          </>
        )}
        {mapSearchMarker !== undefined && (
          <SearchMarker data={mapSearchMarker} colors={colors[mapStyle]} />
        )}
        {snappedPoint !== undefined && <SnappedMarker geojson={snappedPoint} />}
      </ReactMapGL>
    </>
  );
};

export default Map;
