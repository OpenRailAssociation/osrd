import React, { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useParams } from 'react-router-dom';
import { MapLayerMouseEvent } from 'maplibre-gl';
import WebMercatorViewport from 'viewport-mercator-project';
import ReactMapGL, { AttributionControl, MapRef, ScaleControl } from 'react-map-gl/maplibre';
import { Feature, LineString } from 'geojson';
import { BBox, lineString, point } from '@turf/helpers';
import bbox from '@turf/bbox';
import lineLength from '@turf/length';
import lineSlice from '@turf/line-slice';
import { keyBy } from 'lodash';

import { updateTimePositionValues } from 'reducers/osrdsimulation/actions';
import { getPresentSimulation, getSelectedTrain } from 'reducers/osrdsimulation/selectors';
import { Train } from 'reducers/osrdsimulation/types';
import { updateViewport, Viewport } from 'reducers/map';
import { RootState } from 'reducers';
import { TrainPosition } from 'modules/simulationResult/components/SimulationResultsMap/types';

/* Main data & layers */
import Background from 'common/Map/Layers/Background';
import BufferStops from 'common/Map/Layers/BufferStops';
import VirtualLayers from 'modules/simulationResult/components/SimulationResultsMap/VirtualLayers';
/* Settings & Buttons */
import MapButtons from 'common/Map/Buttons/MapButtons';
import Detectors from 'common/Map/Layers/Detectors';
import Catenaries from 'common/Map/Layers/Catenaries';
import NeutralSections from 'common/Map/Layers/NeutralSections';
import Hillshade from 'common/Map/Layers/Hillshade';
import OSM from 'common/Map/Layers/OSM';
import OperationalPoints from 'common/Map/Layers/OperationalPoints';
import PlatformsLayer from 'common/Map/Layers/Platforms';
import RenderItinerary from 'modules/simulationResult/components/SimulationResultsMap/RenderItinerary';
import Routes from 'common/Map/Layers/Routes';
import SearchMarker from 'common/Map/Layers/SearchMarker';
import Signals from 'common/Map/Layers/Signals';
import SpeedLimits from 'common/Map/Layers/SpeedLimits';
import Switches from 'common/Map/Layers/Switches';
/* Objects & various */
import TracksGeographic from 'common/Map/Layers/TracksGeographic';
import TracksOSM from 'common/Map/Layers/TracksOSM';
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
import SNCF_PSL from 'common/Map/Layers/extensions/SNCF/PSL';
import IGN_BD_ORTHO from 'common/Map/Layers/IGN_BD_ORTHO';
import IGN_SCAN25 from 'common/Map/Layers/IGN_SCAN25';
import IGN_CADASTRE from 'common/Map/Layers/IGN_CADASTRE';
import { CUSTOM_ATTRIBUTION } from 'common/Map/const';
import { SimulationReport, osrdEditoastApi } from 'common/api/osrdEditoastApi';
import Terrain from 'common/Map/Layers/Terrain';
import { getTerrain3DExaggeration } from 'reducers/map/selectors';
import { getRegimeKey, getSimulationHoverPositions } from './SimulationResultsMap/helpers';

interface MapProps {
  setExtViewport: (viewport: Viewport) => void;
}

const Map: FC<MapProps> = ({ setExtViewport }) => {
  const mapBlankStyle = useMapBlankStyle();
  const [mapLoaded, setMapLoaded] = useState(false);
  const { viewport, mapSearchMarker, mapStyle, showOSM } = useSelector(
    (state: RootState) => state.map
  );
  const { isPlaying, positionValues, timePosition, allowancesSettings } = useSelector(
    (state: RootState) => state.osrdsimulation
  );
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

  const updateViewportChange = useCallback(
    (value: Partial<Viewport>) => dispatch(updateViewport(value, undefined)),
    [dispatch]
  );
  const mapRef = React.useRef<MapRef>(null);

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
    const { data: path, isError, error } = await getPath({ pathfindingId: pathID });
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
          dispatch(updateTimePositionValues(timePositionLocal));
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

  useEffect(() => {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timePosition]);

  const handleLoadFinished = () => {
    setMapLoaded(true);
  };

  return (
    <>
      <MapButtons map={mapRef.current ?? undefined} resetPitchBearing={resetPitchBearing} />
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
        />
        <TracksOSM
          colors={colors[mapStyle]}
          layerOrder={LAYER_GROUPS_ORDER[LAYERS.TRACKS_OSM.GROUP]}
        />

        <Routes colors={colors[mapStyle]} layerOrder={LAYER_GROUPS_ORDER[LAYERS.ROUTES.GROUP]} />
        <OperationalPoints
          colors={colors[mapStyle]}
          layerOrder={LAYER_GROUPS_ORDER[LAYERS.OPERATIONAL_POINTS.GROUP]}
        />
        <Catenaries
          colors={colors[mapStyle]}
          layerOrder={LAYER_GROUPS_ORDER[LAYERS.CATENARIES.GROUP]}
        />
        <NeutralSections layerOrder={LAYER_GROUPS_ORDER[LAYERS.DEAD_SECTIONS.GROUP]} />
        <BufferStops
          colors={colors[mapStyle]}
          layerOrder={LAYER_GROUPS_ORDER[LAYERS.BUFFER_STOPS.GROUP]}
        />
        <Detectors
          colors={colors[mapStyle]}
          layerOrder={LAYER_GROUPS_ORDER[LAYERS.DETECTORS.GROUP]}
        />
        <Switches
          colors={colors[mapStyle]}
          layerOrder={LAYER_GROUPS_ORDER[LAYERS.SWITCHES.GROUP]}
        />

        <SpeedLimits
          colors={colors[mapStyle]}
          layerOrder={LAYER_GROUPS_ORDER[LAYERS.SPEED_LIMITS.GROUP]}
        />
        <SNCF_PSL
          colors={colors[mapStyle]}
          layerOrder={LAYER_GROUPS_ORDER[LAYERS.SPEED_LIMITS.GROUP]}
        />

        <Signals
          mapRef={mapRef}
          sourceTable="signals"
          colors={colors[mapStyle]}
          layerOrder={LAYER_GROUPS_ORDER[LAYERS.SIGNALS.GROUP]}
        />

        {mapSearchMarker !== undefined ? (
          <SearchMarker data={mapSearchMarker} colors={colors[mapStyle]} />
        ) : null}

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
