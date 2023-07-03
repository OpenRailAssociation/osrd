import React, { FC, useCallback, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useParams } from 'react-router-dom';
import maplibregl from 'maplibre-gl';
import WebMercatorViewport from 'viewport-mercator-project';
import ReactMapGL, { AttributionControl, ScaleControl, MapRef } from 'react-map-gl';
import { Feature, LineString } from 'geojson';
import { lineString, point, BBox } from '@turf/helpers';
import along from '@turf/along';
import bbox from '@turf/bbox';
import lineLength from '@turf/length';
import lineSlice from '@turf/line-slice';
import { last } from 'lodash';

import { updateTimePositionValues } from 'reducers/osrdsimulation/actions';
import { getSelectedTrain } from 'reducers/osrdsimulation/selectors';
import {
  AllowancesSettings,
  PositionValues,
  PositionSpeedTime,
  Train,
} from 'reducers/osrdsimulation/types';
import { updateViewport, Viewport } from 'reducers/map';
import { RootState } from 'reducers';
import { TrainPosition } from 'applications/operationalStudies/components/SimulationResults/SimulationResultsMap/types';

/* Main data & layers */
import Background from 'common/Map/Layers/Background';
import BufferStops from 'common/Map/Layers/BufferStops';
import VirtualLayers from 'applications/operationalStudies/components/SimulationResults/SimulationResultsMap/VirtualLayers';
/* Settings & Buttons */
import MapButtons from 'common/Map/Buttons/MapButtons';
import Detectors from 'common/Map/Layers/Detectors';
import Catenaries from 'common/Map/Layers/Catenaries';
import Hillshade from 'common/Map/Layers/Hillshade';
import OSM from 'common/Map/Layers/OSM';
import OperationalPoints from 'common/Map/Layers/OperationalPoints';
import Platforms from 'common/Map/Layers/Platforms';
import RenderItinerary from 'applications/operationalStudies/components/SimulationResults/SimulationResultsMap/RenderItinerary';
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
import TrainHoverPosition from 'applications/operationalStudies/components/SimulationResults/SimulationResultsMap/TrainHoverPosition';

import colors from 'common/Map/Consts/colors';
import { datetime2Isostring, datetime2sec, timeString2datetime } from 'utils/timeManipulation';
import osmBlankStyle from 'common/Map/Layers/osmBlankStyle';
import {
  getDirection,
  interpolateOnPosition,
  interpolateOnTime,
} from 'applications/operationalStudies/components/SimulationResults/ChartHelpers/ChartHelpers';
import { LAYER_GROUPS_ORDER, LAYERS } from 'config/layerOrder';

import 'common/Map/Map.scss';
import SNCF_LPV from 'common/Map/Layers/extensions/SNCF/SNCF_LPV';
import IGN_BD_ORTHO from 'common/Map/Layers/IGN_BD_ORTHO';
import IGN_SCAN25 from 'common/Map/Layers/IGN_SCAN25';
import IGN_CADASTRE from 'common/Map/Layers/IGN_CADASTRE';
import { CUSTOM_ATTRIBUTION } from 'common/Map/const';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { MapLayerMouseEvent } from '../../../../types';

function getPosition(
  positionValues: PositionValues,
  allowancesSettings?: AllowancesSettings,
  trainId?: number,
  baseKey?: string
) {
  const key = (
    allowancesSettings && trainId && allowancesSettings[trainId]?.ecoBlocks
      ? `eco_${baseKey}`
      : baseKey
  ) as keyof PositionValues;
  return positionValues[key] as PositionSpeedTime;
}

interface MapProps {
  setExtViewport: (viewport: Viewport) => void;
}

type InterpoledTrain = {
  name: string;
  id: number;
  head_positions?: PositionSpeedTime;
  tail_positions?: PositionSpeedTime;
  speeds?: PositionSpeedTime;
};

const Map: FC<MapProps> = ({ setExtViewport }) => {
  const [mapLoaded, setMapLoaded] = useState(false);
  const { viewport, mapSearchMarker, mapStyle, mapTrackSources, showOSM } = useSelector(
    (state: RootState) => state.map
  );
  const { isPlaying, positionValues, timePosition, allowancesSettings } = useSelector(
    (state: RootState) => state.osrdsimulation
  );
  const simulation = useSelector((state: RootState) => state.osrdsimulation.simulation.present);
  const selectedTrain = useSelector(getSelectedTrain);
  const [geojsonPath, setGeojsonPath] = useState<Feature<LineString>>();
  const [selectedTrainHoverPosition, setTrainHoverPosition] = useState<TrainPosition>();
  const [otherTrainsHoverPosition, setOtherTrainsHoverPosition] = useState<TrainPosition[]>([]);
  const [simulationSelectedTrain, setSimulationSelectedTrain] = useState<Train>();
  const [idHover, setIdHover] = useState<string | undefined>(undefined);
  const { urlLat = '', urlLon = '', urlZoom = '', urlBearing = '', urlPitch = '' } = useParams();
  const [getPath] = osrdEditoastApi.useLazyGetPathfindingByIdQuery();
  const dispatch = useDispatch();

  const updateViewportChange = useCallback(
    (value: Partial<Viewport>) => dispatch(updateViewport(value, undefined)),
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

  const createOtherPoints = (): InterpoledTrain[] => {
    const timePositionDate = timeString2datetime(timePosition);
    let actualTime = 0;
    if (timePositionDate instanceof Date) {
      actualTime = datetime2sec(timePositionDate);
    } else {
      console.warn('Try to create Other Train Point from unspecified current time Position');
      return [];
    }

    // First find trains where actual time from position is between start & stop
    const concernedTrains: InterpoledTrain[] = [];
    simulation.trains.forEach((train, idx: number) => {
      const key = getRegimeKey(train.id);
      if (train[key].head_positions[0]) {
        const trainTime = train[key].head_positions[0][0].time;
        const train2ndTime = last(last(train[key].head_positions))?.time as number;
        if (
          actualTime >= trainTime &&
          actualTime <= train2ndTime &&
          train.id !== selectedTrain?.id
        ) {
          const interpolation = interpolateOnTime(
            train[key],
            ['time', 'position'],
            ['head_positions', 'tail_positions', 'speeds'],
            actualTime
          ) as Record<string, PositionSpeedTime>;
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
      if (selectedTrain) {
        const headPositionRaw = getPosition(
          positionValues,
          allowancesSettings,
          selectedTrain.id,
          'headPosition'
        );
        const tailPositionRaw = getPosition(
          positionValues,
          allowancesSettings,
          selectedTrain.id,
          'tailPosition'
        );
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
      }

      // Found trains including timePosition, and organize them with geojson collection of points
      setOtherTrainsHoverPosition(
        createOtherPoints().map((train) => {
          const headDistanceAlong = (train.head_positions?.position ?? 0) / 1000;
          const tailDistanceAlong = (train.tail_positions?.position ?? 0) / 1000;
          const headPosition = along(line, headDistanceAlong, {
            units: 'kilometers',
          });
          const tailPosition = train.tail_positions
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
    const { data: path, isError, error } = await getPath({ id: pathID });
    if (path && !isError) {
      const features = lineString(path.geographic.coordinates);
      setGeojsonPath(features);
      zoomToFeature(bbox(features));
    } else if (isError) {
      console.info('ERROR', error);
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
    });
  };

  const onFeatureHover = (e: MapLayerMouseEvent) => {
    if (mapLoaded && !isPlaying && e && geojsonPath?.geometry?.coordinates && selectedTrain) {
      const line = lineString(geojsonPath.geometry.coordinates);
      const cursorPoint = point(e.lngLat.toArray());
      const key = getRegimeKey(selectedTrain.id);
      const startCoordinates = getDirection(selectedTrain[key].head_positions)
        ? [geojsonPath.geometry.coordinates[0][0], geojsonPath.geometry.coordinates[0][1]]
        : [
            geojsonPath.geometry.coordinates[geojsonPath.geometry.coordinates.length - 1][0],
            geojsonPath.geometry.coordinates[geojsonPath.geometry.coordinates.length - 1][1],
          ];
      const start = point(startCoordinates);
      const sliced = lineSlice(start, cursorPoint, line);
      const positionLocal = lineLength(sliced, { units: 'kilometers' }) * 1000;
      const keyValues = ['position', 'speed'] as const;
      const timePositionLocal = interpolateOnPosition<
        (typeof keyValues)[number],
        PositionSpeedTime
      >({ speed: selectedTrain[key].speeds }, ['position', 'speed'] as const, positionLocal);
      if (timePositionLocal instanceof Date) {
        dispatch(updateTimePositionValues(datetime2Isostring(timePositionLocal)));
      } else {
        throw new Error('Map onFeatureHover, try to update TimePositionValue with incorrect imput');
      }
    }
    if (e?.features?.[0] && e.features[0].properties) {
      setIdHover(e.features[0].properties.id);
    } else {
      setIdHover(undefined);
    }
  };

  const displayPath = () => {
    if (simulationSelectedTrain) {
      getGeoJSONPath(simulationSelectedTrain.path);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    displayPath();
    if (selectedTrain) {
      const foundTrain = simulation.trains.find((train) => train.id === selectedTrain?.id);
      setSimulationSelectedTrain(foundTrain);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTrain]);

  useEffect(() => {
    if (timePosition && geojsonPath) {
      getSimulationHoverPositions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timePosition]);

  const handleLoadFinished = () => {
    setMapLoaded(true);
  };

  return (
    <>
      <MapButtons resetPitchBearing={resetPitchBearing} />
      <ReactMapGL
        {...viewport}
        mapLib={maplibregl}
        cursor="pointer"
        ref={mapRef}
        style={{ width: '100%', height: '100%' }}
        mapStyle={osmBlankStyle}
        onMove={(e) => updateViewportChange(e.viewState)}
        attributionControl={false} // Defined below
        onMouseEnter={onFeatureHover}
        onMouseLeave={() => setIdHover(undefined)}
        onResize={(e) => {
          updateViewportChange({
            width: e.target.getContainer().offsetWidth,
            height: e.target.getContainer().offsetHeight,
          });
        }}
        interactiveLayerIds={interactiveLayerIds}
        touchZoomRotate
        onLoad={handleLoadFinished}
      >
        <VirtualLayers />
        <AttributionControl position="bottom-right" customAttribution={CUSTOM_ATTRIBUTION} />
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
              mapRef={mapRef}
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
              mapRef={mapRef}
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

        {geojsonPath && (
          <RenderItinerary
            geojsonPath={geojsonPath}
            layerOrder={LAYER_GROUPS_ORDER[LAYERS.ITINERARY.GROUP]}
          />
        )}

        {geojsonPath && selectedTrainHoverPosition && (
          <TrainHoverPosition
            point={selectedTrainHoverPosition}
            isSelectedTrain
            geojsonPath={geojsonPath}
            layerOrder={LAYER_GROUPS_ORDER[LAYERS.TRAIN.GROUP]}
          />
        )}
        {geojsonPath &&
          otherTrainsHoverPosition.map((pt) => (
            <TrainHoverPosition
              point={pt}
              geojsonPath={geojsonPath}
              key={pt.id}
              layerOrder={LAYER_GROUPS_ORDER[LAYERS.TRAIN.GROUP]}
            />
          ))}
      </ReactMapGL>
    </>
  );
};

export default Map;
