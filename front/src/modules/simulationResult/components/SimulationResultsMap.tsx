import React, { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useParams } from 'react-router-dom';
import type { MapLayerMouseEvent } from 'maplibre-gl';
import type { MapRef } from 'react-map-gl/maplibre';
import ReactMapGL, { AttributionControl, ScaleControl } from 'react-map-gl/maplibre';
import type { Feature, LineString } from 'geojson';
import { lineString, point } from '@turf/helpers';
import bbox from '@turf/bbox';
import lineLength from '@turf/length';
import lineSlice from '@turf/line-slice';
import { keyBy } from 'lodash';

import type { TrainPosition } from 'modules/simulationResult/components/SimulationResultsMap/types';

import type { RootState } from 'reducers';
import type { Viewport } from 'reducers/map';
import { updateMapSearchMarker, updateViewport } from 'reducers/map';
import type { Train } from 'reducers/osrdsimulation/types';
import { getPresentSimulation, getSelectedTrain } from 'reducers/osrdsimulation/selectors';

/* Main data & layers */
import Background from 'common/Map/Layers/Background';
import BufferStops from 'common/Map/Layers/BufferStops';
import VirtualLayers from 'modules/simulationResult/components/SimulationResultsMap/VirtualLayers';

/* Settings & Buttons */
import RenderItinerary from 'modules/simulationResult/components/SimulationResultsMap/RenderItinerary';

import OSM from 'common/Map/Layers/OSM';
import Routes from 'common/Map/Layers/Routes';
import Signals from 'common/Map/Layers/Signals';
import Switches from 'common/Map/Layers/Switches';
import Detectors from 'common/Map/Layers/Detectors';
import Hillshade from 'common/Map/Layers/Hillshade';
import Electrifications from 'common/Map/Layers/Electrifications';
import MapButtons from 'common/Map/Buttons/MapButtons';
import SpeedLimits from 'common/Map/Layers/SpeedLimits';
import PlatformsLayer from 'common/Map/Layers/Platforms';
import SearchMarker from 'common/Map/Layers/SearchMarker';
import NeutralSections from 'common/Map/Layers/extensions/SNCF/NeutralSections';
import OperationalPoints from 'common/Map/Layers/OperationalPoints';

/* Objects & various */
import TracksOSM from 'common/Map/Layers/TracksOSM';
import TracksGeographic from 'common/Map/Layers/TracksGeographic';

/* Interactions */
import TrainHoverPosition from 'modules/simulationResult/components/SimulationResultsMap/TrainHoverPosition';

import colors from 'common/Map/Consts/colors';
import { useMapBlankStyle } from 'common/Map/Layers/blankStyle';
import {
  getDirection,
  interpolateOnPosition,
} from 'modules/simulationResult/components/ChartHelpers/ChartHelpers';
import { LAYER_GROUPS_ORDER, LAYERS } from 'config/layerOrder';

import 'common/Map/Map.scss';
import Terrain from 'common/Map/Layers/Terrain';
import { CUSTOM_ATTRIBUTION } from 'common/Map/const';
import { useInfraID } from 'common/osrdContext';
import { zoomToFeature } from 'common/Map/WarpedMap/core/helpers';
import IGN_SCAN25 from 'common/Map/Layers/IGN_SCAN25';
import IGN_CADASTRE from 'common/Map/Layers/IGN_CADASTRE';
import IGN_BD_ORTHO from 'common/Map/Layers/IGN_BD_ORTHO';
import SNCF_PSL from 'common/Map/Layers/extensions/SNCF/PSL';
import type { SimulationReport } from 'common/api/osrdEditoastApi';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { getTerrain3DExaggeration } from 'reducers/map/selectors';
import { getRegimeKey, getSimulationHoverPositions } from './SimulationResultsMap/helpers';
import { useChartSynchronizer } from './ChartHelpers/ChartSynchronizer';

interface MapProps {
  setExtViewport: (viewport: Viewport) => void;
}

const Map: FC<MapProps> = () => {
  const mapBlankStyle = useMapBlankStyle();
  const [mapLoaded, setMapLoaded] = useState(false);
  const { viewport, mapSearchMarker, mapStyle, showOSM } = useSelector(
    (state: RootState) => state.map
  );
  const { isPlaying, allowancesSettings } = useSelector((state: RootState) => state.osrdsimulation);
  const simulation = useSelector(getPresentSimulation);
  const trains = useMemo(() => keyBy(simulation.trains, 'id'), [simulation.trains]);
  const selectedTrain = useSelector(getSelectedTrain);
  const terrain3DExaggeration = useSelector(getTerrain3DExaggeration);

  const [geojsonPath, setGeojsonPath] = useState<Feature<LineString>>();
  const [selectedTrainHoverPosition, setTrainHoverPosition] = useState<TrainPosition>();
  const [otherTrainsHoverPosition, setOtherTrainsHoverPosition] = useState<TrainPosition[]>([]);
  const { urlLat = '', urlLon = '', urlZoom = '', urlBearing = '', urlPitch = '' } = useParams();
  const [getPath] = osrdEditoastApi.useLazyGetPathfindingByPathfindingIdQuery();
  const dispatch = useDispatch();

  const { updateTimePosition } = useChartSynchronizer(
    (timePosition, positionValues) => {
      if (timePosition && geojsonPath) {
        const positions = getSimulationHoverPositions(
          geojsonPath,
          simulation,
          timePosition,
          positionValues,
          selectedTrain?.id,
          allowancesSettings
        );
        setTrainHoverPosition(positions.find((train) => train.isSelected));
        setOtherTrainsHoverPosition(positions.filter((train) => !train.isSelected));
      }
    },
    'simulation-result-map',
    [geojsonPath, simulation, selectedTrain, allowancesSettings]
  );

  const updateViewportChange = useCallback(
    (value: Partial<Viewport>) => dispatch(updateViewport(value, undefined)),
    [dispatch]
  );
  const mapRef = React.useRef<MapRef>(null);

  const infraID = useInfraID();

  const getGeoJSONPath = async (pathID: number) => {
    const { data: path, isError, error } = await getPath({ pathfindingId: pathID });
    if (path && !isError) {
      const features = lineString(path.geographic.coordinates);
      setGeojsonPath(features);
      zoomToFeature(bbox(features), viewport, updateViewportChange);
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
      const train = selectedTrain[key];
      if (train) {
        const lastCoordinates =
          geojsonPath.geometry.coordinates[geojsonPath.geometry.coordinates.length - 1];
        const startCoordinates = getDirection(train.head_positions)
          ? [geojsonPath.geometry.coordinates[0][0], geojsonPath.geometry.coordinates[0][1]]
          : [lastCoordinates[0], lastCoordinates[1]];
        const start = point(startCoordinates);
        const sliced = lineSlice(start, cursorPoint, line);
        const positionLocal = lineLength(sliced, { units: 'kilometers' }) * 1000;
        const timePositionLocal = interpolateOnPosition({ speed: train.speeds }, positionLocal);
        if (timePositionLocal instanceof Date) {
          updateTimePosition(timePositionLocal);
        } else {
          throw new Error(
            'Map onFeatureHover, try to update TimePositionValue with incorrect imput'
          );
        }
      }
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
    if (selectedTrain) {
      // TODO: delete this cast when we have chosen the appropriate type for the simulation
      const foundTrain = (simulation.trains as SimulationReport[]).find(
        (train) => train.id === selectedTrain?.id
      );
      if (foundTrain) getGeoJSONPath(foundTrain.path);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTrain]);

  const handleLoadFinished = () => {
    setMapLoaded(true);
  };

  return (
    <>
      <MapButtons
        map={mapRef.current ?? undefined}
        resetPitchBearing={resetPitchBearing}
        bearing={viewport.bearing}
        withMapKeyButton
      />
      <ReactMapGL
        {...viewport}
        cursor="pointer"
        ref={mapRef}
        style={{ width: '100%', height: '100%' }}
        mapStyle={mapBlankStyle}
        onMove={(e) => updateViewportChange(e.viewState)}
        attributionControl={false} // Defined below
        onMouseEnter={onFeatureHover}
        onResize={(e) => {
          updateViewportChange({
            width: e.target.getContainer().offsetWidth,
            height: e.target.getContainer().offsetHeight,
          });
        }}
        onClick={() => {
          dispatch(updateMapSearchMarker(undefined));
        }}
        interactiveLayerIds={interactiveLayerIds}
        touchZoomRotate
        maxPitch={85}
        terrain={
          terrain3DExaggeration
            ? { source: 'terrain', exaggeration: terrain3DExaggeration }
            : undefined
        }
        onLoad={handleLoadFinished}
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
              mapIsLoaded={mapLoaded}
            />
            <Hillshade
              mapStyle={mapStyle}
              layerOrder={LAYER_GROUPS_ORDER[LAYERS.BACKGROUND.GROUP]}
              display={terrain3DExaggeration > 0}
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
          infraID={infraID}
        />
        <TracksOSM
          colors={colors[mapStyle]}
          layerOrder={LAYER_GROUPS_ORDER[LAYERS.TRACKS_OSM.GROUP]}
        />

        <Routes
          colors={colors[mapStyle]}
          layerOrder={LAYER_GROUPS_ORDER[LAYERS.ROUTES.GROUP]}
          infraID={infraID}
        />
        <OperationalPoints
          colors={colors[mapStyle]}
          layerOrder={LAYER_GROUPS_ORDER[LAYERS.OPERATIONAL_POINTS.GROUP]}
          infraID={infraID}
        />
        <Electrifications
          colors={colors[mapStyle]}
          layerOrder={LAYER_GROUPS_ORDER[LAYERS.ELECTRIFICATIONS.GROUP]}
          infraID={infraID}
        />
        <NeutralSections
          colors={colors[mapStyle]}
          layerOrder={LAYER_GROUPS_ORDER[LAYERS.DEAD_SECTIONS.GROUP]}
          infraID={infraID}
        />
        <BufferStops
          colors={colors[mapStyle]}
          layerOrder={LAYER_GROUPS_ORDER[LAYERS.BUFFER_STOPS.GROUP]}
          infraID={infraID}
        />
        <Detectors
          colors={colors[mapStyle]}
          layerOrder={LAYER_GROUPS_ORDER[LAYERS.DETECTORS.GROUP]}
          infraID={infraID}
        />
        <Switches
          colors={colors[mapStyle]}
          layerOrder={LAYER_GROUPS_ORDER[LAYERS.SWITCHES.GROUP]}
          infraID={infraID}
        />

        <SpeedLimits
          colors={colors[mapStyle]}
          layerOrder={LAYER_GROUPS_ORDER[LAYERS.SPEED_LIMITS.GROUP]}
          infraID={infraID}
        />
        <SNCF_PSL
          colors={colors[mapStyle]}
          layerOrder={LAYER_GROUPS_ORDER[LAYERS.SPEED_LIMITS.GROUP]}
          infraID={infraID}
        />

        <Signals
          mapRef={mapRef}
          sourceTable="signals"
          colors={colors[mapStyle]}
          layerOrder={LAYER_GROUPS_ORDER[LAYERS.SIGNALS.GROUP]}
          infraID={infraID}
        />

        {mapSearchMarker && <SearchMarker data={mapSearchMarker} colors={colors[mapStyle]} />}

        {geojsonPath && (
          <RenderItinerary
            geojsonPath={geojsonPath}
            layerOrder={LAYER_GROUPS_ORDER[LAYERS.ITINERARY.GROUP]}
          />
        )}

        {geojsonPath && selectedTrainHoverPosition && selectedTrain && (
          <TrainHoverPosition
            point={selectedTrainHoverPosition}
            isSelectedTrain
            geojsonPath={geojsonPath}
            layerOrder={LAYER_GROUPS_ORDER[LAYERS.TRAIN.GROUP]}
            viewport={viewport}
            train={selectedTrain as Train} // TODO: remove Train interface
            allowancesSettings={allowancesSettings}
          />
        )}
        {geojsonPath &&
          otherTrainsHoverPosition.map((pt) =>
            trains[pt.trainId] ? (
              <TrainHoverPosition
                point={pt}
                geojsonPath={geojsonPath}
                key={pt.id}
                layerOrder={LAYER_GROUPS_ORDER[LAYERS.TRAIN.GROUP]}
                train={trains[pt.trainId] as Train}
                viewport={viewport}
                allowancesSettings={allowancesSettings}
              />
            ) : null
          )}
      </ReactMapGL>
    </>
  );
};

export default Map;
