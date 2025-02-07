import React, { useCallback, useEffect, useMemo, useState } from 'react';

import bbox from '@turf/bbox';
import { lineString, point } from '@turf/helpers';
import lineLength from '@turf/length';
import lineSlice from '@turf/line-slice';
import type { Position } from 'geojson';
import type { MapLayerMouseEvent } from 'maplibre-gl';
import ReactMapGL, { AttributionControl, ScaleControl } from 'react-map-gl/maplibre';
import type { MapRef } from 'react-map-gl/maplibre';
import { useSelector } from 'react-redux';
import { useParams } from 'react-router-dom';

import captureMap from 'applications/operationalStudies/helpers/captureMap';
import type {
  PathPropertiesFormatted,
  SimulationResponseSuccess,
} from 'applications/operationalStudies/types';
import MapButtons from 'common/Map/Buttons/MapButtons';
import TrainOnMap, { type TrainCurrentInfo } from 'common/Map/components/TrainOnMap/TrainOnMap';
import { CUSTOM_ATTRIBUTION } from 'common/Map/const';
import colors from 'common/Map/Consts/colors';
import Background from 'common/Map/Layers/Background';
import { useMapBlankStyle } from 'common/Map/Layers/blankStyle';
import Hillshade from 'common/Map/Layers/Hillshade';
import IGNLayers from 'common/Map/Layers/IGNLayers';
import InfraObjectLayers from 'common/Map/Layers/InfraObjectLayers';
import LineSearchLayer from 'common/Map/Layers/LineSearchLayer';
import OSM from 'common/Map/Layers/OSM';
import PlatformsLayer from 'common/Map/Layers/Platforms';
import SearchMarker from 'common/Map/Layers/SearchMarker';
import Terrain from 'common/Map/Layers/Terrain';
import TracksOSM from 'common/Map/Layers/TracksOSM';
import { removeSearchItemMarkersOnMap } from 'common/Map/utils';
import { computeBBoxViewport } from 'common/Map/WarpedMap/core/helpers';
import { useInfraID } from 'common/osrdContext';
import { LAYER_GROUPS_ORDER, LAYERS } from 'config/layerOrder';
import RenderItinerary from 'modules/simulationResult/components/SimulationResultsMap/RenderItinerary';
import VirtualLayers from 'modules/simulationResult/components/SimulationResultsMap/VirtualLayers';
import type { RootState } from 'reducers';
import { updateViewport, type Viewport } from 'reducers/map';
import { getTerrain3DExaggeration } from 'reducers/map/selectors';
import { getIsPlaying } from 'reducers/simulationResults/selectors';
import { useAppDispatch } from 'store';
import { isoDateWithTimezoneToSec } from 'utils/date';
import { kmToM, mmToM, msToKmh } from 'utils/physics';

import getSelectedTrainHoverPositions from './getSelectedTrainHoverPositions';
import { interpolateOnPosition } from '../ChartHelpers/ChartHelpers';
import { useChartSynchronizer } from '../ChartSynchronizer';

type SimulationResultMapProps = {
  setExtViewport: (mapViewport: Viewport) => void;
  geometry?: PathPropertiesFormatted['geometry'];
  trainSimulation?: SimulationResponseSuccess & { trainId: number; startTime: string };
  pathItemsCoordinates?: Position[];
  setMapCanvas?: (mapCanvas: string) => void;
};

const SimulationResultMap = ({
  geometry,
  trainSimulation,
  pathItemsCoordinates,
  setMapCanvas,
}: SimulationResultMapProps) => {
  const { urlLat = '', urlLon = '', urlZoom = '', urlBearing = '', urlPitch = '' } = useParams();

  const mapBlankStyle = useMapBlankStyle();
  const {
    viewport: mapViewport,
    mapSearchMarker,
    mapStyle,
    showOSM,
  } = useSelector((state: RootState) => state.map);
  const isPlaying = useSelector(getIsPlaying);
  const terrain3DExaggeration = useSelector(getTerrain3DExaggeration);

  const [mapLoaded, setMapLoaded] = useState(false);
  const [interactiveLayerIds, setInteractiveLayerIds] = useState<string[]>([]);
  const [selectedTrainHoverPosition, setSelectedTrainHoverPosition] = useState<TrainCurrentInfo>();
  const mapId = 'simulation-result-map';

  const geojsonPath = useMemo(() => geometry && lineString(geometry.coordinates), [geometry]);

  const dispatch = useAppDispatch();

  const { updateTimePosition } = useChartSynchronizer(
    (_, positionValues) => {
      if (trainSimulation && geojsonPath) {
        const selectedTrainPosition = getSelectedTrainHoverPositions(
          geojsonPath,
          positionValues,
          trainSimulation.trainId
        );
        setSelectedTrainHoverPosition(selectedTrainPosition);
      }
    },
    'simulation-result-map',
    [geojsonPath, trainSimulation]
  );

  const updateViewportChange = useCallback(
    (value: Partial<Viewport>) => dispatch(updateViewport(value, undefined)),
    [dispatch]
  );
  const mapRef = React.useRef<MapRef>(null);

  const infraID = useInfraID();

  const scaleControlStyle = {
    left: 20,
    bottom: 20,
  };

  const resetPitchBearing = () => {
    updateViewportChange({
      ...mapViewport,
      bearing: 0,
      pitch: 0,
    });
  };

  const onPathHover = (e: MapLayerMouseEvent) => {
    if (mapLoaded && !isPlaying && e && geojsonPath && trainSimulation) {
      const line = lineString(geojsonPath.geometry.coordinates);
      const cursorPoint = point(e.lngLat.toArray());

      const startCoordinates = geojsonPath.geometry.coordinates[0];

      const start = point(startCoordinates);
      const sliced = lineSlice(start, cursorPoint, line);
      const positionLocal = kmToM(lineLength(sliced, { units: 'kilometers' }));

      const baseSpeedData = trainSimulation.base.speeds.map((speed, i) => ({
        speed: msToKmh(speed),
        position: mmToM(trainSimulation.base.positions[i]),
        time: trainSimulation.base.times[i],
      }));
      const timePositionLocal = interpolateOnPosition(
        { speed: baseSpeedData },
        positionLocal,
        isoDateWithTimezoneToSec(trainSimulation.startTime)
      );

      if (timePositionLocal instanceof Date) {
        updateTimePosition(timePositionLocal);
      } else {
        throw new Error('Map onFeatureHover, try to update TimePositionValue with incorrect imput');
      }
    }
  };

  useEffect(() => {
    const interactiveLayers: string[] =
      mapLoaded && geojsonPath ? ['geojsonPath', 'main-train-path'] : [];
    setInteractiveLayerIds(interactiveLayers);
  }, [geojsonPath]);

  useEffect(() => {
    if (mapRef.current) {
      if (urlLat) {
        updateViewportChange({
          ...mapViewport,
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
    if (geojsonPath) {
      const newViewport = computeBBoxViewport(bbox(geojsonPath), mapViewport);
      updateViewportChange(newViewport);
    }
  }, [geojsonPath]);

  const handleLoadFinished = () => {
    setMapLoaded(true);
  };

  return (
    <>
      <MapButtons
        map={mapRef.current ?? undefined}
        resetPitchBearing={resetPitchBearing}
        bearing={mapViewport.bearing}
        withMapKeyButton
        viewPort={mapViewport}
        isNewButtons
      />
      <ReactMapGL
        {...mapViewport}
        cursor="pointer"
        ref={mapRef}
        style={{ width: '100%', height: '100%', borderRadius: '10px' }}
        mapStyle={mapBlankStyle}
        onMove={(e) => updateViewportChange(e.viewState)}
        attributionControl={false} // Defined below
        onMouseEnter={onPathHover}
        onResize={(e) => {
          updateViewportChange({
            width: e.target.getContainer().offsetWidth,
            height: e.target.getContainer().offsetHeight,
          });
        }}
        onClick={() => {
          removeSearchItemMarkersOnMap(dispatch);
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
        onIdle={() => {
          captureMap(mapViewport, mapId, setMapCanvas, geometry);
        }}
        id="simulation-result-map"
      >
        <VirtualLayers />
        <AttributionControl position="bottom-right" customAttribution={CUSTOM_ATTRIBUTION} />
        <ScaleControl maxWidth={100} unit="metric" style={scaleControlStyle} />

        {infraID && <InfraObjectLayers infraId={infraID} mapStyle={mapStyle} />}

        <Background
          colors={colors[mapStyle]}
          layerOrder={LAYER_GROUPS_ORDER[LAYERS.BACKGROUND.GROUP]}
        />
        <Terrain />

        <IGNLayers />

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
            />
          </>
        )}

        <PlatformsLayer
          colors={colors[mapStyle]}
          layerOrder={LAYER_GROUPS_ORDER[LAYERS.PLATFORMS.GROUP]}
        />

        <TracksOSM
          colors={colors[mapStyle]}
          layerOrder={LAYER_GROUPS_ORDER[LAYERS.TRACKS_OSM.GROUP]}
        />

        <LineSearchLayer
          layerOrder={LAYER_GROUPS_ORDER[LAYERS.LINE_SEARCH.GROUP]}
          infraID={infraID}
        />

        {mapSearchMarker && <SearchMarker data={mapSearchMarker} colors={colors[mapStyle]} />}

        {geojsonPath && (
          <RenderItinerary
            geojsonPath={geojsonPath}
            layerOrder={LAYER_GROUPS_ORDER[LAYERS.ITINERARY.GROUP]}
            pathItemsCoordinates={pathItemsCoordinates}
          />
        )}

        {geojsonPath && selectedTrainHoverPosition && trainSimulation && (
          <TrainOnMap
            trainInfo={selectedTrainHoverPosition}
            geojsonPath={geojsonPath}
            viewport={mapViewport}
            trainSimulation={trainSimulation}
          />
        )}
      </ReactMapGL>
    </>
  );
};

export default SimulationResultMap;
