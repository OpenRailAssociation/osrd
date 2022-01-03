import React, { useCallback, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { useParams } from 'react-router-dom';
import { get } from 'common/requests';
import ReactMapGL, {
  ScaleControl, AttributionControl, FlyToInterpolator, WebMercatorViewport,
} from 'react-map-gl';
import osmBlankStyle from 'common/Map/Layers/osmBlankStyle';
import colors from 'common/Map/Consts/colors.ts';
import { useSelector, useDispatch } from 'react-redux';
import { updateViewport } from 'reducers/map';
import { datetime2sec } from 'utils/timeManipulation';
import bbox from '@turf/bbox';
import along from '@turf/along';
import lineSlice from '@turf/line-slice';
import lineLength from '@turf/length';
import { lineString, point } from '@turf/helpers';
import { useTranslation } from 'react-i18next';

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
import TrainHoverPosition from 'applications/osrd/components/SimulationMap/TrainHoverPosition';
import TrainHoverPositionOthers from 'applications/osrd/components/SimulationMap/TrainHoverPositionOthers';

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
import RenderItinerary from 'applications/osrd/components/SimulationMap/RenderItinerary';

import {
  getDirection, interpolateOnPosition, interpolateOnTime,
} from 'applications/osrd/components/Helpers/ChartHelpers';
import { updateTimePosition } from 'reducers/osrdsimulation';

const PATHFINDING_URI = '/pathfinding/';

const Map = (props) => {
  const { setExtViewport } = props;
  const {
    viewport, mapSearchMarker, mapStyle, mapTrackSources, showOSM, layersSettings,
  } = useSelector((state) => state.map);
  const {
    isPlaying, selectedTrain, simulation, positionValues, timePosition,
  } = useSelector((state) => state.osrdsimulation);
  const { t } = useTranslation(['map-settings']);
  const [showSearch, setShowSearch] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [geojsonPath, setGeojsonPath] = useState(undefined);
  const [trainHoverPositionOthers, setTrainHoverPositionOthers] = useState(undefined);
  const [trainHoverPosition, setTrainHoverPosition] = useState(undefined);
  const [idHover, setIdHover] = useState(undefined);
  const {
    urlLat, urlLon, urlZoom, urlBearing, urlPitch,
  } = useParams();
  const dispatch = useDispatch();
  const updateViewportChange = useCallback(
    (value) => dispatch(updateViewport(value, undefined)), [dispatch],
  );

  const createOtherPoints = () => {
    const actualTime = datetime2sec(timePosition);
    // First find trains where actual time from position is between start & stop
    const concernedTrains = [];
    simulation.trains.forEach((train, idx) => {
      if (actualTime >= train.base.head_positions[0][0].time
        && actualTime <= train.base.head_positions[
          train.base.head_positions.length - 1][
          train.base.head_positions[train.base.head_positions.length - 1].length - 1].time
        && idx !== selectedTrain) {
        const interpolation = interpolateOnTime(train.base, ['time', 'position'], ['head_positions', 'speeds'], actualTime);
        if (interpolation.head_positions && interpolation.speeds) {
          concernedTrains.push({
            ...interpolation,
            name: train.name,
            id: idx,
          });
        }
      }
    });
    return concernedTrains;
  };

  const getSimulationPositions = () => {
    const line = lineString(geojsonPath.geometry.coordinates);

    if (positionValues.headPosition) {
      const position = along(
        line,
        positionValues.headPosition.position / 1000,
        { units: 'kilometers' },
      );
      setTrainHoverPosition({
        ...position,
        properties: positionValues.speed,
      });
    } else {
      setTrainHoverPosition(undefined);
    }

    // Found trains including timePosition, and organize them with geojson collection of points
    setTrainHoverPositionOthers(createOtherPoints().map((train) => ({
      ...along(
        line,
        train.head_positions.position / 1000,
        { units: 'kilometers' },
      ),
      properties: {
        ...train.head_positions,
        speed: train.speeds.speed,
        name: train.name,
      },
    })));
  };

  const zoomToFeature = (boundingBox) => {
    const [minLng, minLat, maxLng, maxLat] = boundingBox;
    const viewportTemp = new WebMercatorViewport({ ...viewport, width: 600, height: 400 });
    const { longitude, latitude, zoom } = viewportTemp.fitBounds(
      [[minLng, minLat], [maxLng, maxLat]],
      { padding: 40 },
    );
    setExtViewport({
      ...viewport,
      longitude,
      latitude,
      zoom,
    });
  };

  const getGeoJSONPath = async (pathID) => {
    try {
      const path = await get(`${PATHFINDING_URI}${pathID}/`);
      const features = {
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: path.geographic.coordinates,
        },
        properties: {},
      };
      setGeojsonPath(features);
      zoomToFeature(bbox(features));
    } catch (e) {
      console.log('ERROR', e);
    }
  };

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

  const onFeatureHover = (e) => {
    if (!isPlaying && e) {
      const line = lineString(geojsonPath.geometry.coordinates);
      const cursorPoint = point(e.lngLat);
      const startCoordinates = getDirection(simulation.trains[selectedTrain].base.head_positions)
        ? [
          geojsonPath.geometry.coordinates[0][0],
          geojsonPath.geometry.coordinates[0][1],
        ]
        : [
          geojsonPath.geometry.coordinates[geojsonPath.geometry.coordinates.length - 1][0],
          geojsonPath.geometry.coordinates[geojsonPath.geometry.coordinates.length - 1][1],
        ];
      const start = {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'Point',
          coordinates: startCoordinates,
        },
      };
      const sliced = lineSlice(start, cursorPoint, line);
      const positionLocal = lineLength(sliced, { units: 'kilometers' }) * 1000;
      const timePositionLocal = interpolateOnPosition(
        { speed: simulation.trains[selectedTrain].base.speeds },
        ['position', 'speed'],
        positionLocal,
      );
      dispatch(updateTimePosition(timePositionLocal));
    }
    if (e.features[0]) {
      setIdHover(e.features[0].properties.id);
    } else {
      setIdHover(undefined);
    }
  };

  const displayPath = () => {
    if (simulation.trains.length > 0) {
      getGeoJSONPath(simulation.trains[selectedTrain].path);
    }
  };

  const defineInteractiveLayers = () => {
    const interactiveLayersLocal = [];
    if (geojsonPath) {
      interactiveLayersLocal.push('geojsonPath');
    }
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

  useEffect(() => {
    displayPath();
  }, [simulation.trains, selectedTrain]);

  useEffect(() => {
    if (timePosition && geojsonPath) {
      getSimulationPositions();
    }
  }, [timePosition]);

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
        <div className="mb-1 mt-3 border-bottom">Coucou</div>
        <MapSettingsLayers />
      </MapSettings>
      <ReactMapGL
        {...viewport}
        style={{ cursor: 'pointer' }}
        width="100%"
        height="100%"
        mapStyle={osmBlankStyle}
        onViewportChange={updateViewportChange}
        clickRadius={10}
        attributionControl={false} // Defined below
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
            <ElectrificationType geomType="geo" colors={colors[mapStyle]} />
            <TVDs geomType="geo" colors={colors[mapStyle]} idHover={idHover} />
            <Platform colors={colors[mapStyle]} />
            <TracksGeographic colors={colors[mapStyle]} />
            <OperationalPoints geomType="geo" />
            <SignalingType geomType="geo" />
            <SpeedLimits geomType="geo" colors={colors[mapStyle]} />
            <Signals sourceTable="map_midi_signal" colors={colors[mapStyle]} sourceLayer="geo" />
          </>
        ) : (
          <>
            <TracksSchematic colors={colors[mapStyle]} idHover={idHover} />
            <Signals sourceTable="map_midi_signal" colors={colors[mapStyle]} sourceLayer="sch" />
          </>
        )}

        {mapSearchMarker !== undefined ? (
          <SearchMarker data={mapSearchMarker} colors={colors[mapStyle]} />
        ) : null}

        {geojsonPath !== undefined ? (
          <RenderItinerary
            geojsonPath={geojsonPath}
          />
        ) : null}

        {trainHoverPosition !== undefined
          ? <TrainHoverPosition point={trainHoverPosition} /> : null}
        {trainHoverPositionOthers !== undefined
          ? <TrainHoverPositionOthers trainHoverPositionOthers={trainHoverPositionOthers} /> : null}

      </ReactMapGL>
    </>
  );
};

Map.propTypes = {
  setExtViewport: PropTypes.func.isRequired,
};

export default Map;
