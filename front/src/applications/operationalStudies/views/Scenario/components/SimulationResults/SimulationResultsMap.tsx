import React, { useCallback, useEffect, useMemo, useState } from 'react';

import bbox from '@turf/bbox';
import { lineString } from '@turf/helpers';
import type { Position } from 'geojson';
import { compact } from 'lodash';
import { useTranslation } from 'react-i18next';
import { Marker, type MapRef } from 'react-map-gl/maplibre';

import captureMap from 'applications/operationalStudies/helpers/captureMap';
import usePathOps from 'applications/operationalStudies/hooks/usePathOps';
import { useScenarioContext } from 'applications/operationalStudies/hooks/useScenarioContext';
import type { PathPropertiesFormatted } from 'applications/operationalStudies/types';
import { matchOpRefAndOp } from 'applications/operationalStudies/utils';
import type {
  CorePathfindingResultSuccess,
  PathProperties,
  RelatedOperationalPoint,
  TrainSchedule,
} from 'common/api/osrdEditoastApi';
import BaseMap from 'common/Map/BaseMap';
import MapButtons from 'common/Map/Buttons/MapButtons';
import PathStepMarker, { type PathStepsMarkerProps } from 'common/Map/components/PathStepMarker';
import { MapContextProvider } from 'common/Map/useMapContext';
import { computeBBoxViewport } from 'common/Map/WarpedMap/core/helpers';
import { LAYER_GROUPS_ORDER, LAYERS } from 'config/layerOrder';
import getPointOnPathCoordinates from 'modules/pathfinding/helpers/getPointOnPathCoordinates';
import getTrackLengthCumulativeSums from 'modules/pathfinding/helpers/getTrackLengthCumulativeSums';
import Itinerary from 'modules/simulationResult/components/SimulationResultsMap/RenderItinerary';
import { useMapSettings, useMapSettingsActions } from 'reducers/commonMap';
import type { MapSettings, Viewport } from 'reducers/commonMap/types';
import { useAppDispatch } from 'store';
import { getPointOnTrackCoordinates } from 'utils/geometry';
import { mToMm } from 'utils/physics';

const MAP_ID = 'simulation-result-map';

const NO_SELECTED_PATHS: CorePathfindingResultSuccess[] = [];
const NO_SELECTED_PATHS_PROPERTIES: PathProperties[] = [];

// One color per selected path, cycled through if more paths than colors are selected.
// Shared between the itinerary line and its origin/destination markers so overlapping
// paths can still be told apart.
const SELECTED_PATHS_COLORS = [
  '#3C8AFF',
  '#FF6B6B',
  '#22B573',
  '#F4A100',
  '#9B59B6',
  '#00BCD4',
  '#E91E63',
  '#8D6E63',
];

// Pixel gap between two adjacent selected paths, so overlapping tracks are drawn side by side
// instead of on top of each other.
const SELECTED_PATHS_OFFSET_STEP_PX = 4;

// Centers the group of offsets around 0, so the paths fan out on both sides of the real track.
const getSelectedPathOffset = (index: number, total: number) =>
  (index - (total - 1) / 2) * SELECTED_PATHS_OFFSET_STEP_PX;

type SelectedPathMarker = {
  id: string;
  coordinates: Position;
  color: string;
  label: string;
  isOrigin: boolean;
};

type SimulationResultMapProps = {
  pathSteps?: TrainSchedule['path'];
  pathProperties?: PathPropertiesFormatted;
  /** Pathfinding results of every timetable item selected at once, used to draw their itineraries. */
  selectedPaths?: CorePathfindingResultSuccess[];
  selectedPathsProperties?: PathProperties[];
  setMapCanvas?: (mapCanvas: string) => void;
};

const SimulationResultMap = ({
  pathSteps,
  pathProperties,
  selectedPaths = NO_SELECTED_PATHS,
  selectedPathsProperties = NO_SELECTED_PATHS_PROPERTIES,
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

  const geojsonPaths = useMemo(
    () => selectedPathsProperties.map((properties) => lineString(properties.geometry.coordinates)),
    [selectedPathsProperties]
  );

  const [mapMarkers, setMapMarkers] = useState<PathStepsMarkerProps[]>([]);
  const [selectedPathsMarkers, setSelectedPathsMarkers] = useState<SelectedPathMarker[]>([]);

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

  // Compute origin and destination markers for every other selected timetable item's path
  useEffect(() => {
    if (selectedPaths.length === 0) {
      setSelectedPathsMarkers([]);
      return;
    }

    const getSelectedPathsMarkers = async () => {
      const markersByPath = await Promise.all(
        selectedPaths.map(async (path, pathIndex) => {
          const trackIds = path.path.track_section_ranges.map((range) => range.track_section);
          const tracks = await getTrackSectionsByIds(trackIds);
          const tracksLengthCumulativeSums = getTrackLengthCumulativeSums(
            path.path.track_section_ranges
          );
          const color = SELECTED_PATHS_COLORS[pathIndex % SELECTED_PATHS_COLORS.length];

          return [0, path.path_item_positions.length - 1]
            .map((positionIndex) => {
              const coordinates = getPointOnPathCoordinates(
                tracks,
                path.path.track_section_ranges,
                tracksLengthCumulativeSums,
                path.path_item_positions[positionIndex]
              );
              if (!coordinates) return null;
              return {
                id: `selected-path-${pathIndex}-${positionIndex}`,
                coordinates,
                color,
                label: `${pathIndex + 1}`,
                isOrigin: positionIndex === 0,
              };
            })
            .filter((marker): marker is SelectedPathMarker => marker !== null);
        })
      );
      setSelectedPathsMarkers(markersByPath.flat());
    };

    getSelectedPathsMarkers();
  }, [selectedPaths, getTrackSectionsByIds]);

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
        {geojsonPaths.map((geojsonPathFromSelection, index) => (
          <Itinerary
            key={`selected-path-${index}`}
            geojsonPath={geojsonPathFromSelection}
            layerOrder={LAYER_GROUPS_ORDER[LAYERS.PATH.GROUP]}
            idSuffix={index}
            color={SELECTED_PATHS_COLORS[index % SELECTED_PATHS_COLORS.length]}
            offset={getSelectedPathOffset(index, geojsonPaths.length)}
          />
        ))}
        {geojsonPath && (
          <Itinerary geojsonPath={geojsonPath} layerOrder={LAYER_GROUPS_ORDER[LAYERS.PATH.GROUP]} />
        )}

        {pathSteps && mapMarkers.map((marker) => <PathStepMarker key={marker.id} {...marker} />)}
        {selectedPathsMarkers.map((marker) => (
          <Marker
            key={marker.id}
            longitude={marker.coordinates[0]}
            latitude={marker.coordinates[1]}
            anchor="center"
          >
            <div
              className="selected-path-marker"
              style={{
                width: 18,
                height: 18,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 10,
                fontWeight: 'bold',
                color: marker.isOrigin ? '#fff' : marker.color,
                backgroundColor: marker.isOrigin ? marker.color : '#fff',
                border: `2px solid ${marker.color}`,
              }}
              title={marker.isOrigin ? t('requestedOrigin') : t('requestedDestination')}
            >
              {marker.label}
            </div>
          </Marker>
        ))}
      </BaseMap>
    </MapContextProvider>
  );
};

export default SimulationResultMap;
