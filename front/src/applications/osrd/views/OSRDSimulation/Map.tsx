import React, { useCallback, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useParams } from 'react-router-dom';
import ReactMapGL, {
  AttributionControl,
  FlyToInterpolator,
  ScaleControl,
  WebMercatorViewport,
  MapRef,
  MapEvent,
} from 'react-map-gl';
import { Feature, LineString } from 'geojson';
import { lineString, point, BBox } from '@turf/helpers';
import along from '@turf/along';
import bbox from '@turf/bbox';
import lineLength from '@turf/length';
import lineSlice from '@turf/line-slice';
import { CgLoadbar } from 'react-icons/cg';
import { last } from 'lodash';

import {
  updateTimePositionValues,
  AllowancesSettings,
  PositionValues,
  PositionSpeed,
} from 'reducers/osrdsimulation';
import { updateViewport, Viewport } from 'reducers/map';
import { RootState } from 'reducers';
import { TrainPosition } from 'applications/osrd/components/SimulationMap/types';

/* Main data & layers */
import Background from 'common/Map/Layers/Background';
import BufferStops from 'common/Map/Layers/BufferStops';
import VirtualLayers from 'applications/osrd/views/OSRDSimulation/VirtualLayers';
/* Settings & Buttons */
import MapButtons from 'common/Map/Buttons/MapButtons';
import Detectors from 'common/Map/Layers/Detectors';
import Catenaries from 'common/Map/Layers/Catenaries';
import Hillshade from 'common/Map/Layers/Hillshade';
import OSM from 'common/Map/Layers/OSM';
import OperationalPoints from 'common/Map/Layers/OperationalPoints';
import Platform from 'common/Map/Layers/Platform';
import RenderItinerary from 'applications/osrd/components/SimulationMap/RenderItinerary';
import Routes from 'common/Map/Layers/Routes';
import SearchMarker from 'common/Map/Layers/SearchMarker';
import Signals from 'common/Map/Layers/Signals';
import SpeedLimits from 'common/Map/Layers/SpeedLimits';
import Switches from 'common/Map/Layers/Switches';
/* Objects & various */
import TracksGeographic from 'common/Map/Layers/TracksGeographic';
import TracksOSM from 'common/Map/Layers/TracksOSM';
import TracksSchematic from 'common/Map/Layers/TracksSchematic';
/* Interactions */
import TrainHoverPosition from 'applications/osrd/components/SimulationMap/TrainHoverPosition';

import colors from 'common/Map/Consts/colors';
import { datetime2sec } from 'utils/timeManipulation';
import { get } from 'common/requests';
import osmBlankStyle from 'common/Map/Layers/osmBlankStyle';
import {
  getDirection,
  interpolateOnPosition,
  interpolateOnTime,
} from 'applications/osrd/components/Helpers/ChartHelpers';

import 'common/Map/Map.scss';

const PATHFINDING_URI = '/pathfinding/';

function getPosition(
  positionValues: PositionValues,
  allowancesSettings?: AllowancesSettings,
  id?: number,
  baseKey?: string
) {
  const key = (
    allowancesSettings && id && allowancesSettings[id]?.ecoBlocks ? `eco_${baseKey}` : baseKey
  ) as keyof PositionValues;
  return positionValues[key] as PositionSpeed;
}

interface MapProps {
  setExtViewport: (viewport: Viewport) => void;
}

function Map(props: MapProps) {
  const { setExtViewport } = props;
  const [mapLoaded, setMapLoaded] = useState(false);
  const { viewport, mapSearchMarker, mapStyle, mapTrackSources, showOSM, layersSettings } =
    useSelector((state: RootState) => state.map);
  const { isPlaying, selectedTrain, positionValues, timePosition, allowancesSettings } =
    useSelector((state: RootState) => state.osrdsimulation);
  const simulation = useSelector((state: RootState) => state.osrdsimulation.simulation.present);
  const [geojsonPath, setGeojsonPath] = useState<Feature<LineString>>();
  const [selectedTrainHoverPosition, setTrainHoverPosition] = useState<TrainPosition>();
  const [otherTrainsHoverPosition, setOtherTrainsHoverPosition] = useState<TrainPosition[]>([]);
  const [idHover, setIdHover] = useState(undefined);
  const { urlLat = '', urlLon = '', urlZoom = '', urlBearing = '', urlPitch = '' } = useParams();
  const dispatch = useDispatch();
  const updateViewportChange = useCallback(
    (value) => dispatch(updateViewport(value, undefined)),
    [dispatch]
  );
  const mapRef = React.useRef<MapRef>(null);

  /**
   *
   * @param {int} trainId
   * @returns correct key (eco or base) to get positions in a train simulation
   */
  const getRegimeKey = (trainId: number) =>
    allowancesSettings && allowancesSettings[trainId]?.ecoBlocks ? 'eco' : 'base';

  const createOtherPoints = () => {
    const actualTime = datetime2sec(timePosition);
    // First find trains where actual time from position is between start & stop
    const concernedTrains: any[] = [];
    simulation.trains.forEach((train, idx: number) => {
      const key = getRegimeKey(train.id);
      if (train[key].head_positions[0]) {
        const trainTime = train[key].head_positions[0][0].time;
        const train2ndTime = last(last(train[key].head_positions))?.time as number;
        if (actualTime >= trainTime && actualTime <= train2ndTime && idx !== selectedTrain) {
          const interpolation = interpolateOnTime(
            train[key],
            ['time', 'position'],
            ['head_positions', 'tail_positions', 'speeds'],
            actualTime
          ) as Record<string, PositionSpeed>;
          if (interpolation.head_positions && interpolation.speeds) {
            concernedTrains.push({
              ...interpolation,
              name: train.name,
              id: idx,
            });
          }
        }
      }
    });
    return concernedTrains;
  };

  // specifies the position of the trains when hovering over the simulation
  const getSimulationHoverPositions = () => {
    if (geojsonPath) {
      const line = lineString(geojsonPath.geometry.coordinates);
      const id = simulation.trains[selectedTrain]?.id;
      const headPositionRaw = getPosition(positionValues, allowancesSettings, id, 'headPosition');
      const tailPositionRaw = getPosition(positionValues, allowancesSettings, id, 'tailPosition');
      if (headPositionRaw) {
        setTrainHoverPosition(() => {
          const headDistanceAlong = headPositionRaw.position / 1000;
          const tailDistanceAlong = tailPositionRaw.position / 1000;
          const headPosition = along(line, headDistanceAlong, {
            units: 'kilometers',
          });
          const tailPosition = tailPositionRaw
            ? along(line, tailDistanceAlong, { units: 'kilometers' })
            : headPosition;
          const trainLength = Math.abs(headDistanceAlong - tailDistanceAlong);
          return {
            id: 'main-train',
            headPosition,
            tailPosition,
            headDistanceAlong,
            tailDistanceAlong,
            speedTime: positionValues.speed,
            trainLength,
          };
        });
      }

      // Found trains including timePosition, and organize them with geojson collection of points
      setOtherTrainsHoverPosition(
        createOtherPoints().map((train) => {
          const headDistanceAlong = train.head_positions.position / 1000;
          const tailDistanceAlong = train.tail_positions.position / 1000;
          const headPosition = along(line, headDistanceAlong, {
            units: 'kilometers',
          });
          const tailPosition = train.tail_position
            ? along(line, tailDistanceAlong, { units: 'kilometers' })
            : headPosition;
          const trainLength = Math.abs(headDistanceAlong - tailDistanceAlong);
          return {
            id: `other-train-${train.id}`,
            headPosition,
            tailPosition,
            headDistanceAlong,
            tailDistanceAlong,
            speedTime: positionValues.speed,
            trainLength,
          };
        })
      );
    }
  };

  const zoomToFeature = (boundingBox: BBox) => {
    const [minLng, minLat, maxLng, maxLat] = boundingBox;
    const viewportTemp = new WebMercatorViewport({ ...viewport, width: 600, height: 400 });
    const { longitude, latitude, zoom } = viewportTemp.fitBounds(
      [
        [minLng, minLat],
        [maxLng, maxLat],
      ],
      { padding: 40 }
    );
    setExtViewport({
      ...viewport,
      longitude,
      latitude,
      zoom,
    });
  };

  const getGeoJSONPath = async (pathID: number) => {
    try {
      const path = await get(`${PATHFINDING_URI}${pathID}/`);
      const features = lineString(path.geographic.coordinates);
      setGeojsonPath(features);
      zoomToFeature(bbox(features));
    } catch (e) {
      console.info('ERROR', e);
    }
  };

  const scaleControlStyle = {
    left: 20,
    bottom: 20,
  };

  const resetPitchBearing = () => {
    updateViewportChange({
      ...viewport,
      bearing: 0,
      pitch: 0,
      transitionDuration: 1000,
      transitionInterpolator: new FlyToInterpolator(),
    });
  };

  const onFeatureHover = (e: MapEvent) => {
    if (mapLoaded && !isPlaying && e && geojsonPath?.geometry?.coordinates) {
      const line = lineString(geojsonPath.geometry.coordinates);
      const cursorPoint = point(e.lngLat);
      const key = getRegimeKey(simulation.trains[selectedTrain].id);
      const startCoordinates = getDirection(simulation.trains[selectedTrain][key].head_positions)
        ? [geojsonPath.geometry.coordinates[0][0], geojsonPath.geometry.coordinates[0][1]]
        : [
            geojsonPath.geometry.coordinates[geojsonPath.geometry.coordinates.length - 1][0],
            geojsonPath.geometry.coordinates[geojsonPath.geometry.coordinates.length - 1][1],
          ];
      const start = point(startCoordinates);
      const sliced = lineSlice(start, cursorPoint, line);
      const positionLocal = lineLength(sliced, { units: 'kilometers' }) * 1000;
      const timePositionLocal = interpolateOnPosition(
        { speed: simulation.trains[selectedTrain][key].speeds },
        ['position', 'speed'],
        positionLocal
      );
      dispatch(updateTimePositionValues(timePositionLocal));
    }
    if (e?.features?.[0]) {
      setIdHover(e.features[0].properties.id);
    } else {
      setIdHover(undefined);
    }
  };

  const onClick = (e: MapEvent) => {
    if (mapRef.current) {
      console.info('Click on map');
      console.info(mapRef.current.queryRenderedFeatures(e.point));
    }
  };

  const displayPath = () => {
    if (simulation.trains.length > 0) {
      getGeoJSONPath(simulation.trains[selectedTrain].path);
    }
  };

  function defineInteractiveLayers() {
    const interactiveLayersLocal: string[] = [];
    if (mapLoaded && geojsonPath) {
      interactiveLayersLocal.push('geojsonPath');
      interactiveLayersLocal.push('main-train-path');
      otherTrainsHoverPosition.forEach((train) => {
        interactiveLayersLocal.push(`${train.id}-path`);
      });
    }
    return interactiveLayersLocal;
  }
  const [interactiveLayerIds, setInteractiveLayerIds] = useState<string[]>([]);
  useEffect(() => {
    setInteractiveLayerIds(defineInteractiveLayers());
  }, [geojsonPath, otherTrainsHoverPosition.length]);

  useEffect(() => {
    if (mapRef.current) {
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
    }
  }, []);

  useEffect(() => {
    displayPath();
  }, [selectedTrain]);

  useEffect(() => {
    if (timePosition && geojsonPath) {
      getSimulationHoverPositions();
    }
  }, [timePosition]);

  const handleLoadFinished = () => {
    setMapLoaded(true);
  };

  return (
    <>
      <MapButtons resetPitchBearing={resetPitchBearing} />
      <ReactMapGL
        {...viewport}
        style={{ cursor: 'pointer' }}
        ref={mapRef}
        width="100%"
        height="100%"
        mapStyle={osmBlankStyle}
        onViewportChange={updateViewportChange}
        clickRadius={10}
        attributionControl={false} // Defined below
        onHover={onFeatureHover}
        onClick={onClick}
        interactiveLayerIds={interactiveLayerIds}
        touchRotate
        asyncRender
        onLoad={handleLoadFinished}
      >
        <AttributionControl
          className="attribution-control"
          customAttribution="©SNCF/DGEX Solutions"
        />
        <ScaleControl maxWidth={100} unit="metric" style={scaleControlStyle} />

        <Background colors={colors[mapStyle]} />

        {!showOSM ? null : (
          <>
            <OSM mapStyle={mapStyle} />
            <Hillshade mapStyle={mapStyle} />
          </>
        )}

        <VirtualLayers />

        {/* Have to  duplicate objects with sourceLayer to avoid cache problems in mapbox */}
        {mapTrackSources === 'geographic' ? (
          <>
            <Platform colors={colors[mapStyle]} layerOrder={1} />

            <TracksGeographic colors={colors[mapStyle]} layerOrder={2} />
            <TracksOSM colors={colors[mapStyle]} layerOrder={2} />

            <Routes geomType="geo" colors={colors[mapStyle]} layerOrder={3} />
            <OperationalPoints geomType="geo" colors={colors[mapStyle]} layerOrder={3} />
            <Catenaries geomType="geo" colors={colors[mapStyle]} layerOrder={3} />
            <BufferStops geomType="geo" colors={colors[mapStyle]} layerOrder={3} />
            <Detectors geomType="geo" colors={colors[mapStyle]} layerOrder={3} />
            <Switches geomType="geo" colors={colors[mapStyle]} />

            <SpeedLimits geomType="geo" colors={colors[mapStyle]} layerOrder={4} />

            <Signals
              mapRef={mapRef}
              sourceTable="signals"
              colors={colors[mapStyle]}
              sourceLayer="geo"
              layerOrder={5}
            />
          </>
        ) : (
          <>
            <TracksSchematic colors={colors[mapStyle]} idHover={idHover} />
            <OperationalPoints geomType="sch" colors={colors[mapStyle]} layerOrder={3} />
            <Routes geomType="sch" colors={colors[mapStyle]} layerOrder={3} />
            <Signals
              mapRef={mapRef}
              sourceTable="signals"
              colors={colors[mapStyle]}
              sourceLayer="sch"
              layerOrder={5}
            />
            <SpeedLimits geomType="sch" colors={colors[mapStyle]} layerOrder={4} />
            <BufferStops geomType="sch" colors={colors[mapStyle]} layerOrder={3} />
            <Detectors geomType="sch" colors={colors[mapStyle]} layerOrder={3} />
            <Switches geomType="sch" colors={colors[mapStyle]} />
          </>
        )}

        {mapSearchMarker !== undefined ? (
          <SearchMarker data={mapSearchMarker} colors={colors[mapStyle]} />
        ) : null}

        {geojsonPath !== undefined ? <RenderItinerary geojsonPath={geojsonPath} /> : null}

        {geojsonPath && selectedTrainHoverPosition && (
          <TrainHoverPosition
            point={selectedTrainHoverPosition}
            isSelectedTrain
            geojsonPath={geojsonPath}
            layerOrder={6}
          />
        )}
        {geojsonPath &&
          otherTrainsHoverPosition.map((pt) => (
            <TrainHoverPosition point={pt} geojsonPath={geojsonPath} key={pt.id} layerOrder={6} />
          ))}
      </ReactMapGL>
      <div className="handle-tab-resize">
        <CgLoadbar />
      </div>
    </>
  );
}

export default Map;
