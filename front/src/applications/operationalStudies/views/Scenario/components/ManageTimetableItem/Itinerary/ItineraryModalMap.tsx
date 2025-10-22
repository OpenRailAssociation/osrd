import { useCallback, useMemo, useRef, useState } from 'react';

import type { Position } from 'geojson';
import { useTranslation } from 'react-i18next';
import type { MapLayerMouseEvent, MapRef } from 'react-map-gl/maplibre';

import { matchOpRefAndOp } from 'applications/operationalStudies/utils';
import type { PathProperties } from 'common/api/osrdEditoastApi';
import BaseMap from 'common/Map/BaseMap';
import MapButtons from 'common/Map/Buttons/MapButtons';
import { useInfraID } from 'common/osrdContext';
import { LAYER_GROUPS_ORDER, LAYERS } from 'config/layerOrder';
import Itinerary from 'modules/simulationResult/components/SimulationResultsMap/RenderItinerary';
import { useMapSettings, useMapSettingsActions } from 'reducers/commonMap';
import type { Viewport } from 'reducers/commonMap/types';
import type { PathStepMetadata, PathStepV2 } from 'reducers/osrdconf/types';
import { useAppDispatch } from 'store';
import { getBarycenter } from 'utils/geometry';
import { getMapMouseEventNearestFeature } from 'utils/mapHelper';

import type { FeatureInfoClick } from '../types';
import PathStepMarker from './PathStepMarker';
import { computePathStepCoordinates } from './utils';

const OPERATIONAL_POINT_LAYERS = [
  'chartis/osrd_operational_point/geo',
  'chartis/osrd_operational_point_name/geo',
];

const computeOpRefMarkerName = (
  pathStepMetadata: Extract<PathStepMetadata, { isInvalid: false; type: 'opRef' }>
) =>
  `${pathStepMetadata.name}${pathStepMetadata.secondaryCode ? ` ${pathStepMetadata.secondaryCode}` : ''}${pathStepMetadata.trackName ? ` \u00B7 ${pathStepMetadata.trackName}` : ''}`;

type ItineraryModalMapProps = {
  pathSteps?: PathStepV2[];
  pathStepsMetadata?: Map<string, PathStepMetadata>;
  pathProperties?: PathProperties;
};

const ItineraryModalMap = ({
  pathSteps,
  pathStepsMetadata,
  pathProperties,
}: ItineraryModalMapProps) => {
  const { t } = useTranslation('operational-studies', {
    keyPrefix: 'main',
  });
  const dispatch = useAppDispatch();

  const infraID = useInfraID();
  const mapSettings = useMapSettings();
  const { viewport, layersSettings } = mapSettings;
  const { removeMapSearchMarker, updateViewport } = useMapSettingsActions();

  const mapRef = useRef<MapRef | null>(null);

  const [hoveredOperationalPointId, setHoveredOperationalPointId] = useState<string>();

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
    if (layersSettings.tvds) {
      result.push('chartis/osrd_tvd_section/geo');
    }
    return result;
  }, [layersSettings]);

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
        mapSettings={mapSettings}
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
          pathStepsMetadata &&
          pathSteps.map((step, index) => {
            const pathStepMetadata = pathStepsMetadata.get(step.id);
            const pathStepLocation = step.location;
            if (!pathStepLocation || !pathStepMetadata || pathStepMetadata?.isInvalid) return null;

            let coordinates: Position | undefined;
            if (pathProperties?.operational_points) {
              // If there is a pathfinding, we use it to get the simulated coordinates
              if (pathStepMetadata.type == 'trackOffset') {
                coordinates = pathStepMetadata.coordinates;
              } else {
                const matchedOp = pathProperties.operational_points.find((op) =>
                  matchOpRefAndOp(pathStepLocation, op)
                );
                const secondaryCodeMetadata = pathStepMetadata.locationsBySecondaryCode.get(
                  matchedOp?.extensions?.sncf?.ch || ''
                );
                const trackMetadata = secondaryCodeMetadata?.find(
                  (metadata) => metadata.trackId === matchedOp?.part.track
                );
                coordinates = trackMetadata?.coordinates;
              }
            } else {
              // If not, we use the input informations to compute them
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
              />
            );
          })}
      </BaseMap>
    </>
  );
};

export default ItineraryModalMap;
