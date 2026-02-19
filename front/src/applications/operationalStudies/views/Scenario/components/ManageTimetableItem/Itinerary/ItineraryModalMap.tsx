import { useCallback, useMemo, useRef, useState, type PropsWithChildren } from 'react';

import type { Position } from 'geojson';
import { useTranslation } from 'react-i18next';
import type { MapLayerMouseEvent, MapRef } from 'react-map-gl/maplibre';

import { matchOpRefAndOp } from 'applications/operationalStudies/utils';
import type { PathProperties } from 'common/api/osrdEditoastApi';
import BaseMap from 'common/Map/BaseMap';
import MapButtons from 'common/Map/Buttons/MapButtons';
import PathStepMarker, { PATH_STEP_MARKER_STATE } from 'common/Map/components/PathStepMarker';
import { MapContextProvider } from 'common/Map/useMapContext';
import { useInfraID } from 'common/osrdContext';
import { LAYER_GROUPS_ORDER, LAYERS } from 'config/layerOrder';
import Itinerary from 'modules/simulationResult/components/SimulationResultsMap/RenderItinerary';
import { useMapSettings, useMapSettingsActions } from 'reducers/commonMap';
import type { MapSettings, Viewport } from 'reducers/commonMap/types';
import type { PathStepMetadata, PathStepV2 } from 'reducers/osrdconf/types';
import { useAppDispatch } from 'store';
import { getBarycenter } from 'utils/geometry';
import { getMapMouseEventNearestFeature } from 'utils/mapHelper';

import type { FeatureInfoClick } from '../types';
import { computeOpRefMarkerName, computePathStepCoordinates } from './utils';

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
};

const ItineraryModalMap = ({
  pathSteps,
  pathStepsMetadata,
  pathProperties,
  selectedStepId,
  isMapSelectionMode,
  onMapSelectionClick,
  onPathStepDragEnd,
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

  const handleMarkerDragEnd = useCallback(
    (stepId: string, lngLat: { lng: number; lat: number }) => {
      const map = mapRef.current;
      if (!map) return;

      const screenPoint = map.project([lngLat.lng, lngLat.lat]);
      const features = map
        .queryRenderedFeatures(
          [
            [screenPoint.x - 10, screenPoint.y - 10],
            [screenPoint.x + 10, screenPoint.y + 10],
          ],
          { layers: ['chartis/tracks-geo/main'] }
        )
        .filter((f) => f.properties?.id);

      if (!features.length) return;

      onPathStepDragEnd?.(stepId, {
        feature: features[0],
        coordinates: [lngLat.lng, lngLat.lat],
        isOperationalPoint: false,
      });
    },
    [onPathStepDragEnd]
  );

  const resetPitchBearing = () => {
    updateViewportChange({
      ...viewport,
      bearing: 0,
      pitch: 0,
    });
  };

  const onFeatureClick = (e: MapLayerMouseEvent) => {
    const result = getMapMouseEventNearestFeature(e, {
      layersId: [
        'chartis/tracks-geo/main',
        ...(layersSettings.operational_points ? OPERATIONAL_POINT_LAYERS : []),
      ],
    });

    if (isMapSelectionMode) {
      if (result && result.feature.properties && result.feature.properties.id) {
        onMapSelectionClick?.({
          feature: result.feature,
          coordinates: result.nearest,
          isOperationalPoint: result.feature.sourceLayer === 'operational_points',
        });
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
        ...(layersSettings.operational_points ? OPERATIONAL_POINT_LAYERS : []),
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
    } else {
      setHoveredOperationalPointId(undefined);
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
  }, [layersSettings]);

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
            const pathStepMetadata = pathStepsMetadata?.get(step.id);
            const pathStepLocation = step.location;

            if (!pathStepLocation) return null;

            if (pathStepMetadata && !pathStepMetadata.isInvalid) {
              let coordinates: Position | undefined;
              if (pathProperties?.operational_points) {
                // If there is a pathfinding, we use it to get the simulated coordinates
                if (pathStepMetadata.type == 'trackOffset') {
                  coordinates = pathStepMetadata.coordinates;
                } else {
                  const matchedOp = pathProperties.operational_points.find((op) =>
                    matchOpRefAndOp(pathStepLocation, op)
                  );
                  const trackMetadata = pathStepMetadata.parts.find(
                    (part) => part.trackId === matchedOp?.part.track
                  );
                  coordinates = trackMetadata?.coordinates;
                }
              } else {
                const allCoordinates = computePathStepCoordinates(pathStepMetadata);

                coordinates =
                  allCoordinates.length === 1 ? allCoordinates[0] : getBarycenter(allCoordinates);
              }

              if (!coordinates) return null;

              let name = '';
              if (pathStepMetadata.type === 'trackOffset') {
                if (pathStepMetadata.label) {
                  name = pathStepMetadata.label;
                } else if (index === 0) {
                  name = t('requestedOrigin');
                } else if (index === pathSteps.length - 1) {
                  name = t('requestedDestination');
                } else {
                  name = t('requestedPoint', { count: index + 1 });
                }
              } else {
                name = computeOpRefMarkerName(pathStepMetadata);
              }

              return (
                <PathStepMarker
                  key={step.id}
                  id={step.id}
                  markerIndicator={(index + 1).toString()}
                  name={name}
                  coordinates={coordinates}
                  markerState={
                    selectedStepId === step.id ? PATH_STEP_MARKER_STATE.SELECTED : undefined
                  }
                  draggable={!!onPathStepDragEnd && selectedStepId === step.id}
                  onDragEnd={(lngLat) => handleMarkerDragEnd(step.id, lngLat)}
                />
              );
            }

            return null;
          })}
        {children}
      </BaseMap>
    </MapContextProvider>
  );
};

export default ItineraryModalMap;
