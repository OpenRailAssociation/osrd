import { type PropsWithChildren, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import bbox from '@turf/bbox';
import type { Feature, Point } from 'geojson';
import { compact } from 'lodash';
import type { MapLayerMouseEvent } from 'maplibre-gl';
import type { MapRef } from 'react-map-gl/maplibre';
import { useSelector } from 'react-redux';

import captureMap from 'applications/operationalStudies/helpers/captureMap';
import type { ManageTrainSchedulePathProperties } from 'applications/operationalStudies/types';
import type { PathProperties } from 'common/api/osrdEditoastApi';
import BaseMap from 'common/Map/BaseMap';
import MapButtons from 'common/Map/Buttons/MapButtons';
import SnappedMarker from 'common/Map/Layers/SnappedMarker';
import { removeSearchItemMarkersOnMap } from 'common/Map/utils';
import { computeBBoxViewport } from 'common/Map/WarpedMap/core/helpers';
import { useInfraID } from 'common/osrdContext';
import { LAYER_GROUPS_ORDER, LAYERS } from 'config/layerOrder';
import AddPathStepPopup from 'modules/trainschedule/components/ManageTrainSchedule/ManageTrainScheduleMap/AddPathStepPopup';
import { updateViewport } from 'reducers/map';
import type { Viewport } from 'reducers/map';
import { getMap, getTerrain3DExaggeration } from 'reducers/map/selectors';
import { useAppDispatch } from 'store';
import { getMapMouseEventNearestFeature } from 'utils/mapHelper';

import OPERATIONAL_POINT_LAYERS from './consts';
import ItineraryLayer from './ManageTrainScheduleMap/ItineraryLayer';
import ItineraryMarkers, {
  type MarkerInformation,
} from './ManageTrainScheduleMap/ItineraryMarkers';
import type { FeatureInfoClick, SuggestedOP } from './types';

type MapProps = {
  pathProperties?: ManageTrainSchedulePathProperties;
  pathGeometry?: NonNullable<PathProperties['geometry']>;
  setMapCanvas?: (mapCanvas: string) => void;
  hideAttribution?: boolean;
  hideItinerary?: boolean;
  preventPointSelection?: boolean;
  mapId?: string;
  simulationPathSteps: MarkerInformation[];
  pathStepsAndSuggestedOPs?: SuggestedOP[];
  showStdcmAssets?: boolean;
  isFeasible?: boolean;
};

const Map = ({
  pathProperties,
  pathGeometry: geometry,
  setMapCanvas,
  hideAttribution = false,
  hideItinerary = false,
  preventPointSelection = false,
  mapId = 'map-container',
  simulationPathSteps,
  pathStepsAndSuggestedOPs,
  showStdcmAssets = false,
  isFeasible = true,
  children,
}: PropsWithChildren<MapProps>) => {
  const infraID = useInfraID();
  const terrain3DExaggeration = useSelector(getTerrain3DExaggeration);
  const { viewport, mapSearchMarker, mapStyle, showOSM, layersSettings } = useSelector(getMap);
  const mapRef = useRef<MapRef | null>(null);
  const mapContainer = useMemo(() => mapRef.current?.getContainer(), [mapRef.current]);

  const pathGeometry = useMemo(
    () => geometry || pathProperties?.geometry,
    [pathProperties, geometry]
  );

  const [hoveredOperationalPointId, setHoveredOperationalPointId] = useState<string>();
  const [snappedPoint, setSnappedPoint] = useState<Feature<Point> | undefined>();
  const dispatch = useAppDispatch();
  const updateViewportChange = useCallback(
    (value: Partial<Viewport>) => dispatch(updateViewport(value, undefined)),
    [dispatch]
  );

  const [featureInfoClick, setFeatureInfoClick] = useState<FeatureInfoClick>();

  const resetFeatureInfoClick = useCallback(() => {
    setFeatureInfoClick(undefined);
  }, []);

  const closeFeatureInfoClickPopup = useCallback(() => {
    if (featureInfoClick) {
      setFeatureInfoClick(undefined);
    }
  }, [featureInfoClick]);

  const resetPitchBearing = () => {
    updateViewportChange({
      ...viewport,
      bearing: 0,
      pitch: 0,
    });
  };

  const onFeatureClick = (e: MapLayerMouseEvent) => {
    if (preventPointSelection) return;

    const result = getMapMouseEventNearestFeature(e, {
      layersId: [
        'chartis/tracks-geo/main',
        ...(layersSettings.operationalpoints ? OPERATIONAL_POINT_LAYERS : []),
      ],
    });
    if (result && result.feature.properties && result.feature.properties.id) {
      setFeatureInfoClick({
        feature: result.feature,
        coordinates: result.nearest,
        isOperationalPoint: result.feature.sourceLayer === 'operational_points',
      });
    } else {
      setFeatureInfoClick(undefined);
    }
    removeSearchItemMarkersOnMap(dispatch);
  };

  const onMoveGetFeature = (e: MapLayerMouseEvent) => {
    if (preventPointSelection) return;
    const result = getMapMouseEventNearestFeature(e, {
      layersId: [
        'chartis/tracks-geo/main',
        ...(layersSettings.operationalpoints ? OPERATIONAL_POINT_LAYERS : []),
      ],
    });
    if (
      result &&
      result.feature.properties &&
      result.feature.properties.id &&
      (result.feature.geometry.type === 'LineString' || result.feature.geometry.type === 'Point')
    ) {
      if (result.feature.geometry.type === 'Point') {
        setHoveredOperationalPointId(result.feature.properties.id);
      }

      setSnappedPoint({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: result.nearest,
        },
        properties: {
          distance: result.distance,
        },
      });
    } else {
      setHoveredOperationalPointId(undefined);
      setSnappedPoint(undefined);
    }
  };

  const interactiveLayerIds = useMemo(() => {
    const result: Array<string> = [];
    result.push('chartis/tracks-geo/main');
    if (layersSettings.operationalpoints) {
      result.push('chartis/osrd_operational_point/geo');
    }
    if (layersSettings.tvds) {
      result.push('chartis/osrd_tvd_section/geo');
    }
    return result;
  }, [layersSettings]);

  useEffect(() => {
    const points = pathGeometry ?? {
      coordinates: compact(simulationPathSteps.map((step) => step.coordinates)),
      type: 'LineString',
    };
    if (points.coordinates.length > 2) {
      const newViewport = computeBBoxViewport(bbox(points), viewport, {
        width: mapContainer?.clientWidth,
        height: mapContainer?.clientHeight,
        padding: 60,
      });
      dispatch(updateViewport(newViewport));
    }
  }, [pathGeometry, simulationPathSteps, mapContainer]);

  return (
    <>
      <MapButtons
        map={mapRef.current ?? undefined}
        resetPitchBearing={resetPitchBearing}
        closeFeatureInfoClickPopup={closeFeatureInfoClickPopup}
        bearing={viewport.bearing}
        withMapKeyButton
        viewPort={viewport}
        isNewButtons
      />
      <BaseMap
        mapId={mapId}
        mapRef={mapRef}
        cursor={preventPointSelection ? 'default' : 'pointer'}
        hideAttribution={hideAttribution}
        hoveredOperationalPointId={hoveredOperationalPointId}
        infraId={infraID}
        interactiveLayerIds={interactiveLayerIds}
        mapSearchMarker={mapSearchMarker}
        mapStyle={mapStyle}
        onClick={onFeatureClick}
        onIdle={() => {
          captureMap(viewport, mapId, setMapCanvas, pathGeometry);
        }}
        onMouseMove={onMoveGetFeature}
        showOSM={showOSM}
        viewPort={viewport}
        updatePartialViewPort={updateViewportChange}
        terrain3DExaggeration={terrain3DExaggeration}
      >
        {!showStdcmAssets && featureInfoClick && (
          <AddPathStepPopup
            pathProperties={pathProperties}
            featureInfoClick={featureInfoClick}
            resetFeatureInfoClick={resetFeatureInfoClick}
          />
        )}

        <ItineraryLayer
          layerOrder={LAYER_GROUPS_ORDER[LAYERS.ITINERARY.GROUP]}
          geometry={pathGeometry}
          hideItineraryLine={hideItinerary}
          showStdcmAssets={showStdcmAssets}
          isFeasible={isFeasible}
        />
        {infraID && (
          <ItineraryMarkers
            simulationPathSteps={simulationPathSteps}
            pathStepsAndSuggestedOPs={pathStepsAndSuggestedOPs}
            showStdcmAssets={showStdcmAssets}
            infraId={infraID}
          />
        )}
        {snappedPoint !== undefined && <SnappedMarker geojson={snappedPoint} />}

        {children}
      </BaseMap>
    </>
  );
};

export default Map;
