import React, { useCallback, useEffect, useMemo, useState } from 'react';

import bbox from '@turf/bbox';
import { lineString } from '@turf/helpers';
import { compact } from 'lodash';
import { useTranslation } from 'react-i18next';
import type { MapRef } from 'react-map-gl/maplibre';

import captureMap from 'applications/operationalStudies/helpers/captureMap';
import usePathOps from 'applications/operationalStudies/hooks/usePathOps';
import { useScenarioContext } from 'applications/operationalStudies/hooks/useScenarioContext';
import type { PathPropertiesFormatted } from 'applications/operationalStudies/types';
import { matchOpRefAndOp } from 'applications/operationalStudies/utils';
import type { RelatedOperationalPoint, TrainSchedule } from 'common/api/osrdEditoastApi';
import BaseMap from 'common/Map/BaseMap';
import MapButtons from 'common/Map/Buttons/MapButtons';
import PathStepMarker, { type PathStepsMarkerProps } from 'common/Map/components/PathStepMarker';
import { MapContextProvider } from 'common/Map/useMapContext';
import { computeBBoxViewport } from 'common/Map/WarpedMap/core/helpers';
import { LAYER_GROUPS_ORDER, LAYERS } from 'config/layerOrder';
import Itinerary from 'modules/simulationResult/components/SimulationResultsMap/RenderItinerary';
import { useMapSettings, useMapSettingsActions } from 'reducers/commonMap';
import type { MapSettings, Viewport } from 'reducers/commonMap/types';
import { useAppDispatch } from 'store';
import { getPointOnTrackCoordinates } from 'utils/geometry';
import { mToMm } from 'utils/physics';

const MAP_ID = 'simulation-result-map';

type SimulationResultMapProps = {
  pathSteps?: TrainSchedule['path'];
  pathProperties?: PathPropertiesFormatted;
  setMapCanvas?: (mapCanvas: string) => void;
};

const SimulationResultMap = ({
  pathSteps,
  pathProperties,
  setMapCanvas,
}: SimulationResultMapProps) => {
  const { t } = useTranslation('operational-studies', {
    keyPrefix: 'main',
  });

  const dispatch = useAppDispatch();

  const { infraId } = useScenarioContext();
  const { getTrackSectionsByIds } = useScenarioContext();

  const mapSettings = useMapSettings();
  const {
    updateMapSettings: updateMapSettingsAction,
    removeMapSearchMarker,
    updateViewport,
  } = useMapSettingsActions();
  const { viewport } = mapSettings;

  const mapRef = React.useRef<MapRef>(null);

  const geojsonPath = useMemo(
    () => pathProperties && lineString(pathProperties.geometry.coordinates),
    [pathProperties]
  );

  const [mapMarkers, setMapMarkers] = useState<PathStepsMarkerProps[]>([]);

  const pathStepsOperationalPoints = usePathOps(infraId, pathSteps);

  const updateMapSettings = useCallback(
    (value: Partial<MapSettings>) => {
      dispatch(updateMapSettingsAction(value));
    },
    [dispatch]
  );

  // Compute path items coordinates in order to place them on the map
  useEffect(() => {
    const getPathItemsCoordinates = async (
      steps: TrainSchedule['path'],
      matchedOps: Map<string, RelatedOperationalPoint | null>,
      pathPropertiesOps?: PathPropertiesFormatted['operationalPoints']
    ) => {
      // 1. Get path steps track ids to fetch their track metadata
      const allTrackIds = steps.reduce<string[]>((acc, step) => {
        // Need only the requested point track ids from the path step input
        if (step.location.type === 'track_offset') {
          acc.push(step.location.track);
        }
        // Get the track ids from the computed ops
        const matchedOp = pathPropertiesOps?.find((op) => matchOpRefAndOp(step.location, op));
        if (matchedOp) {
          acc.push(matchedOp.part.track);
        }
        return acc;
      }, []);

      const trackSectionsById = await getTrackSectionsByIds(allTrackIds);

      // 2. Build markers data
      const markers = steps.map((step, index) => {
        const { location } = step;

        const markerIndicator = (index + 1).toString();

        if (location.type === 'track_offset') {
          const correspondingTrack = trackSectionsById[location.track];
          const coordinates = correspondingTrack
            ? getPointOnTrackCoordinates(
                correspondingTrack.geo,
                mToMm(correspondingTrack.length),
                location.offset
              )
            : null;

          if (!correspondingTrack || !coordinates) {
            // Can happen in case of requested point id does not exist in infra or
            // if its offset is greater than the track length
            return null;
          }

          let name = '';
          if (index === 0) {
            name = t('requestedOrigin');
          } else if (pathSteps && index === pathSteps.length - 1) {
            name = t('requestedDestination');
          } else {
            name = t('requestedPoint', { count: index + 1 });
          }

          return {
            id: step.id,
            markerIndicator,
            name,
            coordinates,
          };
        }

        if (pathPropertiesOps) {
          const matchedOp = pathPropertiesOps.find((op) => matchOpRefAndOp(location, op));

          if (!matchedOp) return null;

          const correspondingTrack = trackSectionsById[matchedOp.part.track];
          const coordinates = correspondingTrack
            ? getPointOnTrackCoordinates(
                correspondingTrack.geo,
                correspondingTrack.length,
                matchedOp.part.position
              )
            : null;

          if (!coordinates) return null;

          return {
            id: step.id,
            markerIndicator,
            name: matchedOp.name,
            coordinates,
          };
        } else {
          const matchedOp = matchedOps.get(step.id);

          const { local_track_name } = location;
          const coordinates = local_track_name
            ? matchedOp?.parts.find((part) => local_track_name === part.local_track_name)?.geo
                ?.coordinates
            : matchedOp?.geo?.coordinates;

          // If no op is found or if its local_track_name is invalid, it means the path step is invalid
          if (!matchedOp || !coordinates) {
            return null;
          }

          return {
            id: step.id,
            markerIndicator,
            name: matchedOp.name,
            coordinates,
          };
        }
      });

      setMapMarkers(compact(markers));
    };

    if (pathSteps) {
      getPathItemsCoordinates(
        pathSteps,
        pathStepsOperationalPoints,
        pathProperties?.operationalPoints
      );
    }
  }, [pathSteps, pathStepsOperationalPoints, pathProperties?.operationalPoints]);

  const interactiveLayerIds = useMemo(
    () => (geojsonPath ? ['geojsonPath', 'main-train-path'] : []),
    [geojsonPath]
  );

  const updateViewportChange = useCallback(
    (value: Partial<Viewport>) => {
      dispatch(updateViewport(value));
    },
    [dispatch]
  );

  const resetPitchBearing = () => {
    updateViewportChange({
      bearing: 0,
      pitch: 0,
    });
  };

  useEffect(() => {
    if (geojsonPath) {
      const newViewport = computeBBoxViewport(bbox(geojsonPath), viewport);
      updateViewportChange(newViewport);
    } else if (mapMarkers.length > 0) {
      const allMarkersCoordinates = mapMarkers.map((marker) => marker.coordinates);
      const box = bbox({
        type: 'MultiPoint',
        coordinates: allMarkersCoordinates,
      });
      const newViewport = computeBBoxViewport(box, viewport);
      updateViewportChange(newViewport);
    }
  }, [geojsonPath, mapMarkers]);

  return (
    <MapContextProvider
      infraId={infraId}
      mapSettings={mapSettings}
      updateMapSettings={updateMapSettings}
    >
      <MapButtons
        map={mapRef.current ?? undefined}
        resetPitchBearing={resetPitchBearing}
        bearing={viewport.bearing}
        withMapKeyButton
        viewPort={viewport}
        isNewButtons
      />
      <BaseMap
        mapId={MAP_ID}
        mapRef={mapRef}
        cursor="pointer"
        infraId={infraId}
        interactiveLayerIds={interactiveLayerIds}
        cooperativeGestures
        onClick={() => {
          dispatch(removeMapSearchMarker());
        }}
        onIdle={() => {
          captureMap(viewport, MAP_ID, setMapCanvas, pathProperties?.geometry);
        }}
        updatePartialViewPort={updateViewportChange}
        mapSettings={mapSettings}
      >
        {geojsonPath && (
          <Itinerary geojsonPath={geojsonPath} layerOrder={LAYER_GROUPS_ORDER[LAYERS.PATH.GROUP]} />
        )}

        {pathSteps && mapMarkers.map((marker) => <PathStepMarker key={marker.id} {...marker} />)}
      </BaseMap>
    </MapContextProvider>
  );
};

export default SimulationResultMap;
