import 'common/Map/Map.scss';

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import ReactMapGL, {
  AttributionControl,
  FlyToInterpolator,
  ScaleControl,
} from 'react-map-gl';
import { lineString as turfLineString, point as turfPoint } from '@turf/helpers';
import { useDispatch, useSelector } from 'react-redux';

/* Main data & layers */
import Background from 'common/Map/Layers/Background';
/* Settings & Buttons */
import MapButtons from 'common/Map/Buttons/MapButtons';
import Catenaries from 'common/Map/Layers/Catenaries';
import Hillshade from 'common/Map/Layers/Hillshade';
import OSM from 'common/Map/Layers/OSM';
import OperationalPoints from 'common/Map/Layers/OperationalPoints';
import Platform from 'common/Map/Layers/Platform';
import RenderItinerary from 'applications/osrd/components/OSRDConfMap/RenderItinerary';
import RenderItineraryMarkers from 'applications/osrd/components/OSRDConfMap/RenderItineraryMarkers';
/* Interactions */
import RenderPopup from 'applications/osrd/components/OSRDConfMap/RenderPopup';
import Routes from 'common/Map/Layers/Routes';
import SearchMarker from 'common/Map/Layers/SearchMarker';
import SignalingType from 'common/Map/Layers/SignalingType';
import Signals from 'common/Map/Layers/Signals';
import SnappedMarker from 'common/Map/Layers/SnappedMarker';
import SpeedLimits from 'common/Map/Layers/SpeedLimits';
import BufferStops from 'common/Map/Layers/BufferStops.tsx';
import Detectors from 'common/Map/Layers/Detectors.tsx';
import Switches from 'common/Map/Layers/Switches';
import TracksOSM from 'common/Map/Layers/TracksOSM';
/* Objects & various */
import TVDs from 'common/Map/Layers/TVDs';
import TracksGeographic from 'common/Map/Layers/TracksGeographic';
import TracksSchematic from 'common/Map/Layers/TracksSchematic';
import colors from 'common/Map/Consts/colors.ts';
import osmBlankStyle from 'common/Map/Layers/osmBlankStyle';
import turfNearestPointOnLine from '@turf/nearest-point-on-line';
import { updateFeatureInfoClickOSRD } from 'reducers/osrdconf';
import { updateViewport } from 'reducers/map';
import { useParams } from 'react-router-dom';

const Map = () => {
  const {
    viewport, mapSearchMarker, mapStyle, mapTrackSources, showOSM, layersSettings,
  } = useSelector((state) => state.map);
  const [idHover, setIdHover] = useState(undefined);
  const [trackSectionHover, setTrackSectionHover] = useState(undefined);
  const [lngLatHover, setLngLatHover] = useState(undefined);
  const [trackSectionGeoJSON, setTrackSectionGeoJSON] = useState(undefined);
  const [snappedPoint, setSnappedPoint] = useState(undefined);
  const {
    urlLat, urlLon, urlZoom, urlBearing, urlPitch,
  } = useParams();
  const dispatch = useDispatch();
  const updateViewportChange = useCallback(
    (value) => dispatch(updateViewport(value, undefined)), [dispatch],
  );
  const mapRef = useRef(null);

  const scaleControlStyle = {
    left: 20,
    bottom: 20,
  };

  const resetPitchBearing = () => {
    updateViewportChange({
      ...viewport,
      bearing: parseFloat(0),
      pitch: parseFloat(0),
      transitionDuration: 1000,
      transitionInterpolator: new FlyToInterpolator(),
    });
  };

  const onFeatureClick = (e) => {
    if (e.features
      && e.features.length > 0
      && e.features[0].properties.id !== undefined
      // && e.features[0].properties.type_voie === 'VP') {
    ) {
      dispatch(updateFeatureInfoClickOSRD({
        displayPopup: true,
        feature: e.features[0],
        lngLat: e.lngLat,
      }));
    } else {
      dispatch(updateFeatureInfoClickOSRD({
        displayPopup: false,
        feature: undefined,
      }));
    }
  };

  const getGeoJSONFeature = (e) => {
    if (trackSectionHover === undefined
      || e.features[0].properties.id !== trackSectionHover.properties.id) {
      setTrackSectionHover(e.features[0]);
    }

    // Get GEOJSON of features hovered for snapping
    const width = 5;
    const height = 5;
    const features = mapRef.current.queryRenderedFeatures([
      [e.point[0] - width / 2, e.point[1] - height / 2],
      [e.point[0] + width / 2, e.point[1] + height / 2],
    ], {
      layers: mapTrackSources === 'geographic' ? ['chartis/tracks-geo/main'] : ['chartis/tracks-sch/main'],
    });
    if (features[0] !== undefined) {
      setTrackSectionGeoJSON(features[0].geometry);
    }
  };

  const onFeatureHover = (e) => {
    if (e.features !== null && e.features[0] !== undefined) {
      getGeoJSONFeature(e);
      setIdHover(e.features[0].properties.id);
      setLngLatHover(e.lngLat);
    } else {
      setIdHover(undefined);
      setSnappedPoint(undefined);
    }
  };

  const defineInteractiveLayers = () => {
    const interactiveLayersLocal = [];
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
      const line = turfLineString(trackSectionGeoJSON.coordinates);
      const point = turfPoint(lngLatHover);
      setSnappedPoint(turfNearestPointOnLine(line, point));
    }
  }, [trackSectionGeoJSON, trackSectionHover, lngLatHover]);

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
  }, []);

  return (
    <>
      <MapButtons resetPitchBearing={resetPitchBearing} />
      <ReactMapGL
        ref={mapRef}
        {...viewport}
        style={{ cursor: 'pointer' }}
        width="100%"
        height="100%"
        mapStyle={osmBlankStyle}
        onViewportChange={updateViewportChange}
        clickRadius={10}
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
        <ScaleControl
          maxWidth={100}
          unit="metric"
          style={scaleControlStyle}
        />

        <Background colors={colors[mapStyle]} />

        {!showOSM ? null : (
          <>
            <OSM mapStyle={mapStyle} />
            <Hillshade mapStyle={mapStyle} />
          </>
        )}

        {/* Have to  duplicate objects with sourceLayer to avoid cache problems in mapbox */}
        {mapTrackSources === 'geographic' ? (
          <>
            <TVDs geomType="geo" colors={colors[mapStyle]} idHover={idHover} />
            <Catenaries geomType="geo" colors={colors[mapStyle]} />
            <Platform colors={colors[mapStyle]} />
            <TracksGeographic colors={colors[mapStyle]} />
            <TracksOSM colors={colors[mapStyle]} />
            <OperationalPoints geomType="geo" colors={colors[mapStyle]} />
            <SignalingType geomType="geo" />
            <Routes geomType="geo" colors={colors[mapStyle]} />
            <SpeedLimits geomType="geo" colors={colors[mapStyle]} />
            <Signals sourceTable="signals" colors={colors[mapStyle]} sourceLayer="geo" />
            <BufferStops geomType="geo" colors={colors[mapStyle]} />
            <Detectors geomType="geo" colors={colors[mapStyle]} />
            <Switches geomType="geo" colors={colors[mapStyle]} />
            <RenderPopup />
          </>
        ) : (
          <>
            <TracksSchematic colors={colors[mapStyle]} idHover={idHover} />
            <OperationalPoints geomType="sch" colors={colors[mapStyle]} />
            <Routes geomType="sch" colors={colors[mapStyle]} />
            <Signals sourceTable="signals" colors={colors[mapStyle]} sourceLayer="sch" />
            <SpeedLimits geomType="sch" colors={colors[mapStyle]} />
            <BufferStops geomType="sch" colors={colors[mapStyle]} />
            <Detectors geomType="sch" colors={colors[mapStyle]} />
            <Switches geomType="sch" colors={colors[mapStyle]} />
          </>
        )}

        <RenderPopup />
        <RenderItinerary />
        <RenderItineraryMarkers />
        {mapSearchMarker !== undefined ? (
          <SearchMarker data={mapSearchMarker} colors={colors[mapStyle]} />
        ) : null}
        {snappedPoint !== undefined ? <SnappedMarker geojson={snappedPoint} /> : null}

      </ReactMapGL>
    </>
  );
};

export default Map;
