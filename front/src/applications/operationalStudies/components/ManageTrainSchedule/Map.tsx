import React, { useCallback, useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import ReactMapGL, { AttributionControl, ScaleControl, MapRef } from 'react-map-gl';
import { point as turfPoint } from '@turf/helpers';
import { useDispatch, useSelector } from 'react-redux';
import turfNearestPointOnLine, { NearestPointOnLine } from '@turf/nearest-point-on-line';
import { Position, LineString } from 'geojson';
import { useParams } from 'react-router-dom';

import { RootState } from 'reducers';
import { updateFeatureInfoClickOSRD } from 'reducers/osrdconf';
import { updateViewport, Viewport } from 'reducers/map';

/* Main data & layers */
import Background from 'common/Map/Layers/Background';
import VirtualLayers from 'applications/operationalStudies/views/OSRDSimulation/VirtualLayers';
/* Settings & Buttons */
import MapButtons from 'common/Map/Buttons/MapButtons';
import Catenaries from 'common/Map/Layers/Catenaries';
import Hillshade from 'common/Map/Layers/Hillshade';
import OSM from 'common/Map/Layers/OSM';
import OperationalPoints from 'common/Map/Layers/OperationalPoints';
import Platforms from 'common/Map/Layers/Platforms';
import RenderItinerary from 'applications/operationalStudies/components/ManageTrainSchedule/ManageTrainScheduleMap/RenderItinerary';
import RenderItineraryMarkers from 'applications/operationalStudies/components/ManageTrainSchedule/ManageTrainScheduleMap/RenderItineraryMarkers';
/* Interactions */
import RenderPopup from 'applications/operationalStudies/components/ManageTrainSchedule/ManageTrainScheduleMap/RenderPopup';
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
import TracksSchematic from 'common/Map/Layers/TracksSchematic';
import colors from 'common/Map/Consts/colors';
import osmBlankStyle from 'common/Map/Layers/osmBlankStyle';
import { LAYER_GROUPS_ORDER, LAYERS } from 'config/layerOrder';
import 'common/Map/Map.scss';
import SNCF_LPV from 'common/Map/Layers/extensions/SNCF/SNCF_LPV';
import IGN_BD_ORTHO from 'common/Map/Layers/IGN_BD_ORTHO';
import IGN_SCAN25 from 'common/Map/Layers/IGN_SCAN25';
import IGN_CADASTRE from 'common/Map/Layers/IGN_CADASTRE';
import { MapLayerMouseEvent } from '../../../../types';
import { getMapMouseEventNearestFeature } from '../../../../utils/mapboxHelper';

function Map() {
  const { viewport, mapSearchMarker, mapStyle, mapTrackSources, showOSM, layersSettings } =
    useSelector((state: RootState) => state.map);
  const [idHover, setIdHover] = useState<string | undefined>(undefined);
  const [lngLatHover, setLngLatHover] = useState<Position>();
  const [trackSectionGeoJSON, setTrackSectionGeoJSON] = useState<LineString>();
  const [snappedPoint, setSnappedPoint] = useState<NearestPointOnLine>();
  const { urlLat = '', urlLon = '', urlZoom = '', urlBearing = '', urlPitch = '' } = useParams();
  const dispatch = useDispatch();
  const updateViewportChange = useCallback(
    (value: Partial<Viewport>) => dispatch(updateViewport(value, undefined)),
    [dispatch]
  );
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
    const result = getMapMouseEventNearestFeature(e);
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
    const result = getMapMouseEventNearestFeature(e);
    if (
      result &&
      result.feature.properties &&
      result.feature.properties.id &&
      result.feature.geometry.type === 'LineString'
    ) {
      setTrackSectionGeoJSON(result.feature.geometry);
      setIdHover(result.feature.properties.id);
      setLngLatHover(result.nearest);
    } else {
      setIdHover(undefined);
      setSnappedPoint(undefined);
    }
  };

  const defineInteractiveLayers = () => {
    const interactiveLayersLocal: Array<string> = [];
    if (mapTrackSources === 'geographic') {
      interactiveLayersLocal.push('chartis/tracks-geo/main');
      if (layersSettings.operationalpoints) {
        interactiveLayersLocal.push('chartis/osrd_operational_point/geo');
      }
    }
    if (mapTrackSources === 'schematic') {
      interactiveLayersLocal.push('chartis/tracks-sch/main');
      if (layersSettings.operationalpoints) {
        interactiveLayersLocal.push('chartis/osrd_operational_point/sch');
      }
    }
    if (layersSettings.tvds) {
      interactiveLayersLocal.push('chartis/osrd_tvd_section/geo');
    }
    return interactiveLayersLocal;
  };

  useEffect(() => {
    if (trackSectionGeoJSON !== undefined && lngLatHover !== undefined) {
      const point = turfPoint(lngLatHover);
      try {
        setSnappedPoint(turfNearestPointOnLine(trackSectionGeoJSON, point));
      } catch (error) {
        console.warn(`Ìmpossible to snapPoint - error ${error}`);
      }
    }
  }, [trackSectionGeoJSON, lngLatHover]);

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
      <MapButtons resetPitchBearing={resetPitchBearing} />
      <ReactMapGL
        ref={mapRef}
        {...viewport}
        mapLib={maplibregl}
        style={{ width: '100%', height: '100%' }}
        cursor="pointer"
        mapStyle={osmBlankStyle}
        onMove={(e) => updateViewportChange(e.viewState)}
        onMouseMove={(e) => onMoveGetFeature(e)}
        attributionControl={false} // Defined below
        onClick={onFeatureClick}
        onResize={(e) => {
          updateViewportChange({
            width: e.target.getContainer().offsetWidth,
            height: e.target.getContainer().offsetHeight,
          });
        }}
        interactiveLayerIds={defineInteractiveLayers()}
        touchZoomRotate
        data-testid="map"
      >
        <VirtualLayers />
        <AttributionControl position="bottom-right" customAttribution="©SNCF Réseau" />
        <ScaleControl maxWidth={100} unit="metric" style={scaleControlStyle} />

        <Background
          colors={colors[mapStyle]}
          layerOrder={LAYER_GROUPS_ORDER[LAYERS.BACKGROUND.GROUP]}
        />

        <IGN_BD_ORTHO layerOrder={LAYER_GROUPS_ORDER[LAYERS.BACKGROUND.GROUP]} />
        <IGN_SCAN25 layerOrder={LAYER_GROUPS_ORDER[LAYERS.BACKGROUND.GROUP]} />
        <IGN_CADASTRE layerOrder={LAYER_GROUPS_ORDER[LAYERS.BACKGROUND.GROUP]} />

        {!showOSM ? null : (
          <>
            <OSM mapStyle={mapStyle} layerOrder={LAYER_GROUPS_ORDER[LAYERS.BACKGROUND.GROUP]} />
            <Hillshade
              mapStyle={mapStyle}
              layerOrder={LAYER_GROUPS_ORDER[LAYERS.BACKGROUND.GROUP]}
            />
          </>
        )}

        {/* Have to  duplicate objects with sourceLayer to avoid cache problems in mapbox */}
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
              layerOrder={LAYER_GROUPS_ORDER[LAYERS.SPEED_LIMITS.GROUP]}
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
            <Catenaries
              geomType="sch"
              colors={colors[mapStyle]}
              layerOrder={LAYER_GROUPS_ORDER[LAYERS.CATENARIES.GROUP]}
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
          </>
        )}

        <RenderPopup />
        <RenderItinerary layerOrder={LAYER_GROUPS_ORDER[LAYERS.ITINERARY.GROUP]} />
        <RenderItineraryMarkers />
        {mapSearchMarker !== undefined ? (
          <SearchMarker data={mapSearchMarker} colors={colors[mapStyle]} />
        ) : null}
        {snappedPoint !== undefined ? <SnappedMarker geojson={snappedPoint} /> : null}
      </ReactMapGL>
    </>
  );
}

export default Map;
