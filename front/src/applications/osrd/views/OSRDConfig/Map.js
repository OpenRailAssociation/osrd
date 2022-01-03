import React, {
  useCallback, useEffect, useState, useRef,
} from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import ReactMapGL, {
  ScaleControl, AttributionControl, FlyToInterpolator,
} from 'react-map-gl';
import osmBlankStyle from 'common/Map/Layers/osmBlankStyle';
import colors from 'common/Map/Consts/colors.ts';
import { useSelector, useDispatch } from 'react-redux';
import { updateViewport } from 'reducers/map';
import { updateFeatureInfoClickOSRD } from 'reducers/osrdconf';
import { point as turfPoint, lineString as turfLineString } from '@turf/helpers';
import turfNearestPointOnLine from '@turf/nearest-point-on-line';

import 'common/Map/Map.scss';

/* Settings & Buttons */
import ButtonMapSearch from 'common/Map/ButtonMapSearch';
import ButtonResetViewport from 'common/Map/ButtonResetViewport';
import ButtonMapSettings from 'common/Map/ButtonMapSettings';
import MapSearch from 'common/Map/Search/MapSearch';
import MapSettings from 'common/Map/Settings/MapSettings';
import MapSettingsLayers from 'common/Map/Settings/MapSettingsLayers';
import MapSettingsSignals from 'common/Map/Settings/MapSettingsSignals';
import MapSettingsMapStyle from 'common/Map/Settings/MapSettingsMapStyle';
import MapSettingsTrackSources from 'common/Map/Settings/MapSettingsTrackSources';
import MapSettingsShowOSM from 'common/Map/Settings/MapSettingsShowOSM';

/* Interactions */
import RenderPopup from 'applications/osrd/components/OSRDConfMap/RenderPopup';
import RenderItinerary from 'applications/osrd/components/OSRDConfMap/RenderItinerary';
import RenderItineraryMarkers from 'applications/osrd/components/OSRDConfMap/RenderItineraryMarkers';

/* Main data & layers */
import Background from 'common/Map/Layers/Background';
import OSM from 'common/Map/Layers/OSM';
import Hillshade from 'common/Map/Layers/Hillshade';
import Platform from 'common/Map/Layers/Platform';
import TracksSchematic from 'common/Map/Layers/TracksSchematic';
import TracksGeographic from 'common/Map/Layers/TracksGeographic';

/* Objects & various */
import TVDs from 'common/Map/Layers/TVDs';
import OperationalPoints from 'common/Map/Layers/OperationalPoints';
import SignalingType from 'common/Map/Layers/SignalingType';
import SpeedLimits from 'common/Map/Layers/SpeedLimits';
import SpeedLimitsColors from 'common/Map/Layers/SpeedLimitsColors';
import ElectrificationType from 'common/Map/Layers/ElectrificationType';
import Signals from 'common/Map/Layers/Signals';
import SearchMarker from 'common/Map/Layers/SearchMarker';
import SnappedMarker from 'common/Map/Layers/SnappedMarker';

const Map = () => {
  const {
    viewport, mapSearchMarker, mapStyle, mapTrackSources, showOSM, layersSettings,
  } = useSelector((state) => state.map);
  const { t } = useTranslation(['map-settings']);
  const [showSearch, setShowSearch] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
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

  const toggleMapSearch = () => {
    setShowSearch(!showSearch);
  };
  const toggleMapSettings = () => {
    setShowSettings(!showSettings);
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
    ], { layers: ['chartis/tracks-geo/service'] });
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
    } else {
      interactiveLayersLocal.push('schematicMainLayer');
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
      <div className="btn-map-container">
        <ButtonMapSearch toggleMapSearch={toggleMapSearch} />
        <ButtonMapSettings toggleMapSettings={toggleMapSettings} />
        <ButtonResetViewport updateLocalViewport={resetPitchBearing} />
      </div>
      <MapSearch active={showSearch} toggleMapSearch={toggleMapSearch} />
      <MapSettings active={showSettings} toggleMapSettings={toggleMapSettings}>
        <MapSettingsMapStyle />
        <div className="my-2" />
        <MapSettingsTrackSources />
        <div className="my-2" />
        <MapSettingsShowOSM />
        <div className="mb-1 mt-3 border-bottom">Signalisation</div>
        <MapSettingsSignals />
        <div className="mb-1 mt-3 border-bottom">{t('map-settings:layers')}</div>
        <MapSettingsLayers />
      </MapSettings>
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
            <SpeedLimitsColors geomType="geo" />
            <TVDs geomType="geo" colors={colors[mapStyle]} idHover={idHover} />
            <ElectrificationType geomType="geo" colors={colors[mapStyle]} />
            <Platform colors={colors[mapStyle]} />
            <TracksGeographic colors={colors[mapStyle]} />
            <OperationalPoints geomType="geo" />
            <SignalingType geomType="geo" />
            <SpeedLimits geomType="geo" colors={colors[mapStyle]} />
            <Signals sourceTable="map_midi_signal" colors={colors[mapStyle]} sourceLayer="geo" />
            <RenderPopup />
          </>
        ) : (
          <>
            <TracksSchematic colors={colors[mapStyle]} idHover={idHover} />
            <Signals sourceTable="map_midi_signal" colors={colors[mapStyle]} sourceLayer="sch" />
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
