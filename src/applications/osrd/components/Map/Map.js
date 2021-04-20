import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import ReactMapGL, { ScaleControl, AttributionControl, FlyToInterpolator } from 'react-map-gl';
import osmBlankStyle from 'common/Map/Layers/osmBlankStyle';
import colors from 'common/Map/Consts/colors';
import { useSelector, useDispatch } from 'react-redux';
import { updateViewport } from 'reducers/map';
import { updateFeatureInfoClickOSRD } from 'reducers/osrdconf';
import { useTranslation } from 'react-i18next';

import 'common/Map/Map.scss';

/* Settings & Buttons */
import ButtonMapSearch from 'common/Map/ButtonMapSearch';
import ButtonResetViewport from 'common/Map/ButtonResetViewport';
import ButtonMapSettings from 'common/Map/ButtonMapSettings';
import MapSearch from 'common/Map/Search/MapSearch';
import MapSettings from 'common/Map/Settings/MapSettings';
import MapSettingsSignals from 'common/Map/Settings/MapSettingsSignals';
import MapSettingsMapStyle from 'common/Map/Settings/MapSettingsMapStyle';
import MapSettingsTrackSources from 'common/Map/Settings/MapSettingsTrackSources';
import MapSettingsShowOSM from 'common/Map/Settings/MapSettingsShowOSM';

/* Interactions */
import RenderPopup from 'applications/osrd/components/Map/RenderPopup';
import RenderItinerary from 'applications/osrd/components/Map/RenderItinerary';
import RenderItineraryMarkers from 'applications/osrd/components/Map/RenderItineraryMarkers';

/* Main data & layers */
import Background from 'common/Map/Layers/Background';
import OSM from 'common/Map/Layers/OSM';
import Hillshade from 'common/Map/Layers/Hillshade';
import Platform from 'common/Map/Layers/Platform';
import TracksSchematic from 'common/Map/Layers/TracksSchematic';
import TracksGeographic from 'common/Map/Layers/TracksGeographic';

/* Objects & various */
import JointsDeZones from 'common/Map/Layers/JointsDeZones';
import Signals from 'common/Map/Layers/Signals';
import SearchMarker from 'common/Map/Layers/SearchMarker';

const Map = () => {
  const {
    viewport, mapSearchMarker, mapStyle, mapTrackSources, showOSM,
  } = useSelector((state) => state.map);
  const [showSearch, setShowSearch] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [idHover, setIdHover] = useState(undefined);
  const {
    urlLat, urlLon, urlZoom, urlBearing, urlPitch,
  } = useParams();
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const updateViewportChange = useCallback(
    (value) => dispatch(updateViewport(value, undefined)), [dispatch],
  );

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
      && e.features[0].properties.OP_id !== undefined
      && e.features[0].properties.type_voie === 'VP') {
      console.log('coucou', 'OK');
      dispatch(updateFeatureInfoClickOSRD({
        displayPopup: true,
        feature: e.features[0],
        lngLat: e.lngLat,
      }));
    } else {
      console.log('coucou', 'NOK');
      dispatch(updateFeatureInfoClickOSRD({
        displayPopup: false,
        feature: undefined,
      }));
    }
  };

  const onFeatureHover = (e) => {
    if (e.features !== null && e.features[0] !== undefined) {
      setIdHover(e.features[0].properties.OP_id);
    }
  };

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
      </MapSettings>
      <ReactMapGL
        {...viewport}
        style={{ cursor: 'pointer' }}
        width="100%"
        height="100%"
        mapStyle={osmBlankStyle}
        onViewportChange={updateViewportChange}
        clickRadius={4}
        attributionControl={false} // Defined below
        onClick={onFeatureClick}
        onHover={onFeatureHover}
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
            <Platform colors={colors[mapStyle]} />
            <TracksGeographic colors={colors[mapStyle]} idHover={idHover} />
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

      </ReactMapGL>
    </>
  );
};

export default Map;
