import { useCallback, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react';

import type { Feature, Position } from 'geojson';
import { useTranslation } from 'react-i18next';
import type { MapLayerMouseEvent, MapRef } from 'react-map-gl/maplibre';

import { matchOpRefAndWaypoint } from 'applications/operationalStudies/utils';
import {
  osrdEditoastApi,
  type OperationalPoint,
  type PathItemLocation,
  type PathProperties,
} from 'common/api/osrdEditoastApi';
import BaseMap from 'common/Map/BaseMap';
import MapButtons from 'common/Map/Buttons/MapButtons';
import PathStepMarker, { PATH_STEP_MARKER_STATE } from 'common/Map/components/PathStepMarker';
import { SnappedMarker } from 'common/Map/Layers';
import { MapContextProvider } from 'common/Map/useMapContext';
import { useInfraID } from 'common/osrdContext';
import { LAYER_GROUPS_ORDER, LAYERS } from 'config/layerOrder';
import Itinerary from 'modules/simulationResult/components/SimulationResultsMap/RenderItinerary';
import { useMapSettings, useMapSettingsActions } from 'reducers/commonMap';
import type { MapSettings, Viewport } from 'reducers/commonMap/types';
import { setFailure } from 'reducers/main';
import type { PathStepMetadata, PathStepV2 } from 'reducers/osrdconf/types';
import { useAppDispatch } from 'store';
import { castErrorToFailure } from 'utils/error';
import { getBarycenter, nearestPointOnLine } from 'utils/geometry';
import { getMapMouseEventNearestFeature } from 'utils/mapHelper';

import type { FeatureInfoClick } from '../types';
import OpTrackSelectionPopup, { type PendingOpClick } from './OpTrackSelectionPopup';
import {
  buildOpDisplayName,
  buildOpRef,
  computeOpRefMarkerName,
  computePathStepCoordinates,
} from './utils';

const OPERATIONAL_POINT_LAYERS = [
  'chartis/osrd_operational_point/geo',
  'chartis/osrd_operational_point_name/geo',
];

type ItineraryModalMapProps = {
  pathSteps?: PathStepV2[];
  pathStepsMetadata?: Map<string, PathStepMetadata>;
  pathProperties?: PathProperties;
  selectedStepId?: string;
  isMapSelectionMode?: boolean;
  onMapSelectionClick?: (featureInfoClick: FeatureInfoClick) => void;
  onPathStepDragEnd?: (stepId: string, featureInfoClick: FeatureInfoClick) => void;
  onOpSelectionConfirm?: (location: PathItemLocation, displayName: string) => void;
  getStepName?: (stepId: string) => string | undefined;
};

const ItineraryModalMap = ({
  pathSteps,
  pathStepsMetadata,
  pathProperties,
  selectedStepId,
  isMapSelectionMode,
  onMapSelectionClick,
  onPathStepDragEnd,
  onOpSelectionConfirm,
  getStepName,
  children,
}: PropsWithChildren<ItineraryModalMapProps>) => {
  const { t } = useTranslation('operational-studies', {
    keyPrefix: 'main',
  });
  const dispatch = useAppDispatch();

  const infraID = useInfraID();
  const mapSettings = useMapSettings();
  const { viewport, layersSettings } = mapSettings;
  const {
    updateMapSettings: updateMapSettingsAction,
    removeMapSearchMarker,
    updateViewport,
  } = useMapSettingsActions();

  const mapRef = useRef<MapRef | null>(null);

  const [hoveredOperationalPointId, setHoveredOperationalPointId] = useState<string>();
  const [isDraggingMarker, setIsDraggingMarker] = useState(false);
  const [snapDragPosition, setSnapDragPosition] = useState<{
    stepId: string;
    coordinates: Position;
    feature: Feature;
  } | null>(null);
  const [markerResetKeys, setMarkerResetKeys] = useState<Record<string, number>>({});
  const [cursorMarker, setCursorMarker] = useState<{
    coordinates: Position;
    onTrack: boolean;
  } | null>(null);
  const [pendingOpClick, setPendingOpClick] = useState<PendingOpClick | null>(null);

  const [getInfraObjectEntity] =
    osrdEditoastApi.endpoints.postInfraByInfraIdObjectsAndObjectType.useLazyQuery();

  const lastStepHasLocation = !!pathSteps?.at(-1)?.location;
  const lastRealStepIndex = pathSteps ? pathSteps.length - (lastStepHasLocation ? 1 : 2) : -1;

  const isNewPlacement = isMapSelectionMode;

  useEffect(() => {
    if (!isMapSelectionMode) {
      setCursorMarker(null);
      mapRef.current?.getMap().getCanvas().style.removeProperty('cursor');
      setPendingOpClick(null);
    }
  }, [isMapSelectionMode]);

  const updateMapSettings = useCallback(
    (value: Partial<MapSettings>) => {
      dispatch(updateMapSettingsAction(value));
    },
    [dispatch]
  );

  const updateViewportChange = useCallback(
    (value: Partial<Viewport>) => {
      dispatch(updateViewport(value));
    },
    [dispatch]
  );

  const [featureInfoClick, setFeatureInfoClick] = useState<FeatureInfoClick>();

  const closeFeatureInfoClickPopup = useCallback(() => {
    if (featureInfoClick) {
      setFeatureInfoClick(undefined);
    }
  }, [featureInfoClick]);

  const querySnapOnTrack = useCallback(
    (lngLat: { lng: number; lat: number }): { feature: Feature; coordinates: Position } | null => {
      const map = mapRef.current;
      if (!map) return null;

      const screenPoint = map.project([lngLat.lng, lngLat.lat]);
      const features = map
        .queryRenderedFeatures(
          [
            [screenPoint.x - 5, screenPoint.y - 5],
            [screenPoint.x + 5, screenPoint.y + 5],
          ],
          { layers: ['chartis/tracks-geo/main'] }
        )
        .filter((f) => f.properties?.id);

      if (!features.length) return null;

      const feature = features[0] as Feature;
      // Snap coordinates to the nearest point on the track geometry
      if (feature.geometry.type === 'LineString') {
        const snapped = nearestPointOnLine(feature.geometry, [lngLat.lng, lngLat.lat]);
        return { feature, coordinates: snapped.geometry.coordinates };
      }
      return { feature, coordinates: [lngLat.lng, lngLat.lat] };
    },
    []
  );

  const handleMarkerDrag = useCallback(
    (stepId: string, lngLat: { lng: number; lat: number }) => {
      const result = querySnapOnTrack(lngLat);
      setSnapDragPosition(result ? { stepId, ...result } : null);
    },
    [querySnapOnTrack]
  );

  const handleMarkerDragEnd = useCallback(
    (stepId: string, lngLat: { lng: number; lat: number }) => {
      setIsDraggingMarker(false);

      // Use the last snapped position computed during drag, otherwise re-query at drop point
      const snapped =
        snapDragPosition?.stepId === stepId ? snapDragPosition : querySnapOnTrack(lngLat);
      setSnapDragPosition(null);

      if (!snapped) {
        setMarkerResetKeys((prev) => ({ ...prev, [stepId]: (prev[stepId] ?? 0) + 1 }));
        return;
      }

      onPathStepDragEnd?.(stepId, {
        feature: snapped.feature,
        coordinates: snapped.coordinates,
        isOperationalPoint: false,
      });
    },
    [onPathStepDragEnd, snapDragPosition, querySnapOnTrack]
  );

  const resetPitchBearing = () => {
    updateViewportChange({
      ...viewport,
      bearing: 0,
      pitch: 0,
    });
  };

  const handleOpClick = useCallback(
    async (feature: Feature, coordinates: number[]) => {
      const objectId = feature.properties?.id;
      if (!objectId || !infraID) return;

      try {
        const result = await getInfraObjectEntity({
          infraId: infraID,
          objectType: 'OperationalPoint',
          body: [objectId],
        }).unwrap();

        if (!result.length) return;

        const op = result[0].railjson as OperationalPoint;
        const clickedTrackName = feature.properties?.local_track_name ?? null;

        setPendingOpClick({
          coordinates,
          opRef: buildOpRef(op),
          parts: op.parts,
          clickedTrackName,
          displayName: buildOpDisplayName(op),
        });
      } catch (error) {
        dispatch(setFailure(castErrorToFailure(error)));
      }
    },
    [infraID, getInfraObjectEntity]
  );

  const onFeatureClick = (e: MapLayerMouseEvent) => {
    const result = getMapMouseEventNearestFeature(e, {
      layersId: [
        'chartis/tracks-geo/main',
        ...(layersSettings.operational_points || isMapSelectionMode
          ? OPERATIONAL_POINT_LAYERS
          : []),
      ],
    });

    if (isMapSelectionMode) {
      if (result?.feature.properties?.id) {
        if (result.feature.sourceLayer === 'operational_points') {
          handleOpClick(result.feature, result.nearest);
        } else {
          onMapSelectionClick?.({
            feature: result.feature,
            coordinates: result.nearest,
            isOperationalPoint: false,
          });
        }
      }
      return;
    }

    if (result && result.feature.properties && result.feature.properties.id) {
      setFeatureInfoClick({
        feature: result.feature,
        coordinates: result.nearest,
        isOperationalPoint: result.feature.sourceLayer === 'operational_points',
      });
    } else {
      setFeatureInfoClick(undefined);
    }
    dispatch(removeMapSearchMarker());
  };

  const onMoveGetFeature = (e: MapLayerMouseEvent) => {
    const result = getMapMouseEventNearestFeature(e, {
      layersId: [
        'chartis/tracks-geo/main',
        ...(layersSettings.operational_points || isNewPlacement ? OPERATIONAL_POINT_LAYERS : []),
      ],
    });
    if (isNewPlacement) {
      if (
        result &&
        result.feature.properties &&
        result.feature.properties.id &&
        result.feature.geometry.type === 'Point'
      ) {
        setHoveredOperationalPointId(result.feature.properties.id);
      } else {
        setHoveredOperationalPointId(undefined);
      }
    }

    if (isNewPlacement && !isDraggingMarker) {
      if (result && result.feature.geometry.type === 'LineString') {
        setCursorMarker({ coordinates: result.nearest, onTrack: true });
      } else if (result && result.feature.geometry.type === 'Point') {
        setCursorMarker({ coordinates: result.nearest, onTrack: true });
      } else {
        setCursorMarker({ coordinates: e.lngLat.toArray(), onTrack: false });
      }
      e.target.getCanvas().style.cursor = 'copy';
    }
  };

  const interactiveLayerIds = useMemo(() => {
    const result: Array<string> = [];
    result.push('chartis/tracks-geo/main');
    if (layersSettings.operational_points) {
      result.push('chartis/osrd_operational_point/geo');
    }
    if (layersSettings.track_sections) {
      result.push('chartis/osrd_tvd_section/geo');
    }
    return result;
  }, [layersSettings, isMapSelectionMode]);

  return (
    <MapContextProvider
      infraId={infraID}
      mapSettings={mapSettings}
      updateMapSettings={updateMapSettings}
    >
      <MapButtons
        map={mapRef.current ?? undefined}
        resetPitchBearing={resetPitchBearing}
        closeFeatureInfoClickPopup={closeFeatureInfoClickPopup}
        bearing={viewport.bearing}
        withMapKeyButton
        viewPort={viewport}
        isNewButtons
        layersModalContainer={document.querySelector('.itinerary-modal-map')}
      />
      <BaseMap
        mapId="map-container"
        mapRef={mapRef}
        cursor="pointer"
        hoveredOperationalPointId={hoveredOperationalPointId}
        infraId={infraID}
        interactiveLayerIds={interactiveLayerIds}
        onClick={onFeatureClick}
        onMouseMove={onMoveGetFeature}
        mapSettings={mapSettings}
        updatePartialViewPort={updateViewportChange}
      >
        {pathProperties && pathProperties.geometry && (
          <Itinerary
            layerOrder={LAYER_GROUPS_ORDER[LAYERS.PATH.GROUP]}
            geojsonPath={pathProperties.geometry}
          />
        )}
        {pathSteps &&
          pathSteps.map((step, index) => {
            const pathStepMetadata = pathStepsMetadata?.get(step.key);
            const pathStepLocation = step.location;

            if (!pathStepMetadata || !pathStepLocation || pathStepMetadata.isInvalid) return null;

            let coordinates: Position | undefined;
            if (pathProperties?.operational_points) {
              // If there is a pathfinding, we use it to get the simulated coordinates
              if (pathStepMetadata.type === 'trackOffset') {
                coordinates = pathStepMetadata.coordinates;
              } else {
                const matchedOp = pathProperties.operational_points.find((op) =>
                  matchOpRefAndWaypoint(pathStepLocation, op)
                );
                const trackMetadata = pathStepMetadata.parts.find(
                  (part) => part.type === 'valid' && part.trackId === matchedOp?.part.track
                );
                coordinates =
                  trackMetadata?.type === 'valid' ? trackMetadata.coordinates : undefined;
              }
            } else {
              const allCoordinates = computePathStepCoordinates(pathStepMetadata);

              coordinates =
                allCoordinates.length === 1 ? allCoordinates[0] : getBarycenter(allCoordinates);
            }

            if (!coordinates) return null;

            let name = '';
            if (pathStepMetadata.type === 'trackOffset') {
              const stepName = getStepName?.(step.key);
              if (stepName) {
                name = stepName;
              } else if (pathStepMetadata.label) {
                name = pathStepMetadata.label;
              } else if (index === 0) {
                name = t('requestedOrigin');
              } else if (index === lastRealStepIndex) {
                name = t('requestedDestination');
              } else {
                name = t('requestedPoint', { count: index + 1 });
              }
            } else {
              name = computeOpRefMarkerName(pathStepMetadata);
            }

            const isSelected = selectedStepId === step.key;

            return (
              <PathStepMarker
                key={step.key}
                id={step.key}
                testId="path-step-marker"
                markerIndicator={(index + 1).toString()}
                name={name}
                coordinates={coordinates}
                markerState={isSelected ? PATH_STEP_MARKER_STATE.SELECTED : undefined}
                isSelected={isSelected}
                resetKey={markerResetKeys[step.key]}
                draggable={!!onPathStepDragEnd && isSelected}
                onDragStart={() => setIsDraggingMarker(true)}
                onDrag={(lngLat) => handleMarkerDrag(step.key, lngLat)}
                onDragEnd={(lngLat) => handleMarkerDragEnd(step.key, lngLat)}
              />
            );
          })}
        {isMapSelectionMode && cursorMarker?.onTrack && (
          <SnappedMarker
            geojson={{
              type: 'Feature',
              geometry: { type: 'Point', coordinates: cursorMarker.coordinates },
              properties: {},
            }}
          />
        )}
        {snapDragPosition && (
          <SnappedMarker
            geojson={{
              type: 'Feature',
              geometry: { type: 'Point', coordinates: snapDragPosition.coordinates },
              properties: {},
            }}
          />
        )}
        {pendingOpClick && (
          <OpTrackSelectionPopup
            pendingOpClick={pendingOpClick}
            onCancel={() => setPendingOpClick(null)}
            onConfirm={(location) => {
              onOpSelectionConfirm?.(location, pendingOpClick.displayName);
              setPendingOpClick(null);
            }}
          />
        )}
        {children}
      </BaseMap>
    </MapContextProvider>
  );
};

export default ItineraryModalMap;
