import 'common/Map/Map.scss';

import React, { useCallback, useEffect, useState } from 'react';
import ReactMapGL, { AttributionControl, FlyToInterpolator, ScaleControl } from 'react-map-gl';
import { useDispatch, useSelector } from 'react-redux';

/* Main data & layers */
import Background from 'common/Map/Layers/Background';
import ButtonFullscreen from 'common/ButtonFullscreen';
/* Settings & Buttons */
import ButtonMapSearch from 'common/Map/ButtonMapSearch';
import ButtonMapSettings from 'common/Map/ButtonMapSettings';
import ButtonResetViewport from 'common/Map/ButtonResetViewport';
import ElectrificationType from 'common/Map/Layers/ElectrificationType';
import Hillshade from 'common/Map/Layers/Hillshade';
import JointsDeZones from 'common/Map/Layers/JointsDeZones';
import MapSearch from 'common/Map/Search/MapSearch';
import MapSettings from 'common/Map/Settings/MapSettings';
import MapSettingsLayers from 'common/Map/Settings/MapSettingsLayers';
import MapSettingsMapStyle from 'common/Map/Settings/MapSettingsMapStyle';
import MapSettingsShowOSM from 'common/Map/Settings/MapSettingsShowOSM';
import MapSettingsSignals from 'common/Map/Settings/MapSettingsSignals';
import MapSettingsTrackSources from 'common/Map/Settings/MapSettingsTrackSources';
import OSM from 'common/Map/Layers/OSM';
/* Objects & various */
import OperationalPoints from 'common/Map/Layers/OperationalPoints';
import Platform from 'common/Map/Layers/Platform';
import SearchMarker from 'common/Map/Layers/SearchMarker';
import SignalingType from 'common/Map/Layers/SignalingType';
import Signals from 'common/Map/Layers/Signals';
import SpeedLimits from 'common/Map/Layers/SpeedLimits';
import SpeedLimitsColors from 'common/Map/Layers/SpeedLimitsColors';
import TVDs from 'common/Map/Layers/TVDs';
import TracksGeographic from 'common/Map/Layers/TracksGeographic';
import TracksSchematic from 'common/Map/Layers/TracksSchematic';
import colors from 'common/Map/Consts/colors.ts';
import osmBlankStyle from 'common/Map/Layers/osmBlankStyle';
import { updateViewport } from 'reducers/map';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const Map = () => {
  const {
    viewport, mapSearchMarker, mapStyle, mapTrackSources, showOSM, layersSettings,
  } = useSelector((state) => state.map);
  const { t } = useTranslation(['map-settings']);
  const [showSettings, setShowSettings] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [idHover, setIdHover] = useState(undefined);
  const {
    urlLat, urlLon, urlZoom, urlBearing, urlPitch,
  } = useParams();
  const { fullscreen } = useSelector((state) => state.main);
  const dispatch = useDispatch();
  const updateViewportChange = useCallback((value) => dispatch(updateViewport(value, '/carto')), [dispatch]);

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
    console.log('coucou', e.features);
  };

  const onFeatureHover = (e) => {
    if (e.features[0] !== undefined) {
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
    <main className={`mastcontainer mastcontainer-map${fullscreen ? ' fullscreen' : ''}`}>
      <div className="btn-map-container">
        <ButtonMapSearch toggleMapSearch={toggleMapSearch} />
        <ButtonMapSettings toggleMapSettings={toggleMapSettings} />
        <ButtonResetViewport updateLocalViewport={resetPitchBearing} />
        <ButtonFullscreen />
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
        antialiasing
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

        {/* Have to duplicate objects with sourceLayer to avoid cache problems in mapbox */}
        {mapTrackSources === 'geographic' ? (
          <>
            <SpeedLimitsColors geomType="geo" />
            <ElectrificationType geomType="geo" colors={colors[mapStyle]} />
            <TVDs geomType="geo" colors={colors[mapStyle]} idHover={idHover} />
            <Platform colors={colors[mapStyle]} />
            <TracksGeographic colors={colors[mapStyle]} />
            <OperationalPoints geomType="geo" colors={colors[mapStyle]} />
            <SignalingType geomType="geo" />
            <SpeedLimits geomType="geo" colors={colors[mapStyle]} />
            <Signals sourceTable="signals" colors={colors[mapStyle]} sourceLayer="geo" />
          </>
        ) : (
          <>
            <TracksSchematic colors={colors[mapStyle]} idHover={idHover} />
            <OperationalPoints geomType="sch" colors={colors[mapStyle]} />
            <Signals sourceTable="signals" colors={colors[mapStyle]} sourceLayer="sch" />
          </>
        )}

        {mapSearchMarker !== undefined ? (
          <SearchMarker data={mapSearchMarker} colors={colors[mapStyle]} />
        ) : null}
      </ReactMapGL>
    </main>
  );
};

export default Map;
