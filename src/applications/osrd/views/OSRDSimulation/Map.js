import React, { useCallback, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { useParams } from 'react-router-dom';
import ReactMapGL, {
  ScaleControl, AttributionControl, FlyToInterpolator, WebMercatorViewport,
} from 'react-map-gl';
import osmBlankStyle from 'common/Map/Layers/osmBlankStyle';
import colors from 'common/Map/Consts/colors.ts';
import { useSelector, useDispatch } from 'react-redux';
import { updateViewport } from 'reducers/map';
import { sec2time } from 'utils/timeManipulation';
import bbox from '@turf/bbox';

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
import TrainHoverPosition from 'applications/osrd/components/SimulationMap/TrainHoverPosition';

/* Main data & layers */
import Background from 'common/Map/Layers/Background';
import OSM from 'common/Map/Layers/OSM';
import Hillshade from 'common/Map/Layers/Hillshade';
import Platform from 'common/Map/Layers/Platform';
import TracksSchematic from 'common/Map/Layers/TracksSchematic';
import TracksGeographic from 'common/Map/Layers/TracksGeographic';

/* Objects & various */
import Signals from 'common/Map/Layers/Signals';
import SearchMarker from 'common/Map/Layers/SearchMarker';
import RenderItinerary from 'applications/osrd/components/SimulationMap/RenderItinerary';

const createGeoJSONPath = (steps) => {
  const features = [];
  steps.forEach((step, idx) => {
    if (steps[idx + 1] !== undefined) {
      features.push({
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: [step.geo_position, steps[idx + 1].geo_position],
        },
        properties: {
          end_block_occupancy: step.end_block_occupancy,
          head_position: step.head_position,
          hover_position: idx,
          speed: step.speed,
          start_block_occupancy: step.start_block_occupancy,
          tail_position: step.tail_position,
          time: sec2time(step.time),
        },
      });
    }
  });
  return {
    type: 'FeatureCollection',
    features,
  };
};

const Map = (props) => {
  const {
    hoverPosition, selectedTrain, setExtViewport, setHoverPosition, simulation,
  } = props;
  const {
    viewport, mapSearchMarker, mapStyle, mapTrackSources, showOSM,
  } = useSelector((state) => state.map);
  const [showSearch, setShowSearch] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [geojsonPath, setGeojsonPath] = useState(undefined);
  const [trainHoverPosition, setTrainHoverPosition] = useState(undefined);
  const [idHover, setIdHover] = useState(undefined);
  const {
    urlLat, urlLon, urlZoom, urlBearing, urlPitch,
  } = useParams();
  const dispatch = useDispatch();
  const updateViewportChange = useCallback(
    (value) => dispatch(updateViewport(value, undefined)), [dispatch],
  );

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
    if (e.features !== null && e.features[0] !== undefined) {
      setHoverPosition(e.features[0].properties.hover_position);
    }
  };

  const displayPath = () => {
    if (simulation.trains.length > 0
      && simulation.trains[selectedTrain].steps[hoverPosition] !== undefined) {
      const geojson = createGeoJSONPath(simulation.trains[selectedTrain].steps);
      setGeojsonPath(geojson);
      zoomToFeature(bbox(geojson));
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
    displayPath();
  }, []);

  useEffect(() => {
    displayPath();
  }, [simulation.train, selectedTrain]);

  useEffect(() => {
    if (simulation.trains.length > 0
      && hoverPosition !== undefined
      && simulation.trains[selectedTrain].steps[hoverPosition] !== undefined) {
      setTrainHoverPosition(simulation.trains[selectedTrain].steps[hoverPosition]);
    }
  }, [hoverPosition]);

  return (
    <>
      <div className="btn-map-container">
        <ButtonMapSearch toggleMapSearch={toggleMapSearch} />
        <ButtonMapSettings toggleMapSettings={toggleMapSettings} />
        <ButtonResetViewport updateLocalViewport={resetPitchBearing} />
      </div>
      {/* }<MapSearch active={showSearch} toggleMapSearch={toggleMapSearch} /> */}
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
        onHover={onFeatureHover}
        interactiveLayerIds={geojsonPath ? ['geojsonPath'] : ['']}
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

        {geojsonPath !== undefined
          ? <RenderItinerary geojson={geojsonPath} /> : null}

        {trainHoverPosition !== undefined
          ? <TrainHoverPosition point={trainHoverPosition} /> : null}

      </ReactMapGL>
    </>
  );
};

Map.propTypes = {
  selectedTrain: PropTypes.number.isRequired,
  setExtViewport: PropTypes.func.isRequired,
  setHoverPosition: PropTypes.func.isRequired,
  hoverPosition: PropTypes.number,
  simulation: PropTypes.object.isRequired,
};
Map.defaultProps = {
  hoverPosition: undefined,
};

export default Map;
