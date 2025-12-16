import { useEffect, useMemo, useState } from 'react';

import { skipToken } from '@reduxjs/toolkit/query';
import type { Position } from 'geojson';

import usePathOps from 'applications/operationalStudies/hooks/usePathOps';
import { useScenarioContext } from 'applications/operationalStudies/hooks/useScenarioContext';
import {
  osrdEditoastApi,
  type OperationalPointPartReference,
  type TrainSchedule,
} from 'common/api/osrdEditoastApi';
import type { PathStepMetadata, PathStepV2 } from 'reducers/osrdconf/types';
import { getPointOnTrackCoordinates } from 'utils/geometry';

/**
 * For each path step, get all its secondary codes and track names to display in the form
 * and update the pathStepsMetadataById state.
 */
export const usePathStepsMetadata = (pathSteps: PathStepV2[]) => {
  const { infraId, getTrackSectionsByIds } = useScenarioContext();

  const [pathStepsMetadataById, setPathStepsMetadataById] = useState<Map<string, PathStepMetadata>>(
    new Map()
  );

  // 1. Extract the train path to extract its steps related operational points
  const strippedTrainPath: TrainSchedule['path'] = useMemo(
    () =>
      pathSteps.reduce<TrainSchedule['path']>((acc, step) => {
        if (!step.location) return acc;
        if ('operational_point' in step.location) {
          if (
            step.location.operational_point.type === 'uic' ||
            step.location.operational_point.type === 'trigram'
          ) {
            // strip location from its secondary_code so we can have all matchs for an uic or trigram
            const { secondary_code: _secCode, ...operational_point } =
              step.location.operational_point;
            acc.push({
              id: step.id,
              location: {
                operational_point,
              },
            });
            return acc;
          }
        }
        acc.push({
          id: step.id,
          location: step.location,
        });
        return acc;
      }, []),
    [pathSteps]
  );

  const pathStepsOperationalPoints = usePathOps(infraId, strippedTrainPath, {
    returnAllOps: true,
  });

  // 2. Since a path step containing 'operational_point' as location will have only one match
  // with postInfraByInfraIdMatchOperationalPoints, we need to call the endpoint again with
  // the opId corresponding uic in order to get all the possible matches and have
  // all the secondary codes and track names
  const uicPayload: OperationalPointPartReference[] = useMemo(() => {
    const opIds = pathSteps.reduce<string[]>((acc, step) => {
      if (
        step.location &&
        'operational_point' in step.location &&
        step.location.operational_point.type === 'id'
      ) {
        acc.push(step.location.operational_point.operational_point);
      }
      return acc;
    }, []);

    if (opIds.length === 0) return [];

    return pathStepsOperationalPoints.reduce<OperationalPointPartReference[]>((acc, op) => {
      const uic = op.extensions?.identifier?.uic;
      if (uic && opIds.includes(op.id)) {
        acc.push({ operational_point: { uic, type: 'uic' } });
      }
      return acc;
    }, []);
  }, [pathSteps, pathStepsOperationalPoints]);

  const { currentData: allOpIdsOperationalPoints } =
    osrdEditoastApi.endpoints.postInfraByInfraIdMatchOperationalPoints.useQuery(
      uicPayload.length > 0
        ? {
            infraId,
            body: {
              operational_point_references: uicPayload,
            },
          }
        : skipToken
    );

  // 3. Merge both operational points lists to have all possible matches
  const allOps = useMemo(
    () => [
      ...pathStepsOperationalPoints,
      ...(allOpIdsOperationalPoints?.related_operational_points || []).flat(),
    ],
    [pathStepsOperationalPoints, allOpIdsOperationalPoints]
  );

  useEffect(() => {
    const fetchAndSetMetadata = async () => {
      // 4. Get all track ids of all matched operational points to get all tracks metadata
      const matchedTrackIds = new Set<string>();
      allOps.forEach((op) => {
        op.parts.forEach((part) => {
          matchedTrackIds.add(part.track);
        });
      });
      const allTrackIds = Array.from(matchedTrackIds);

      // Add requested points track ids
      pathSteps.forEach(
        (step) => step.location && 'track' in step.location && allTrackIds.push(step.location.track)
      );

      const trackSectionsById = await getTrackSectionsByIds(allTrackIds);

      // 5. Loop of the path steps to build the metadata map
      const newPathStepsMetadataById = new Map<string, PathStepMetadata>();

      pathSteps.forEach((pathStep) => {
        const { location } = pathStep;

        if (!location) {
          newPathStepsMetadataById.set(pathStep.id, { isInvalid: true });
          return;
        }

        if ('track' in location) {
          // TODO : replace the name by the track offset label when provided by backend
          const correspondingTrack = trackSectionsById[location.track];

          const coordinates = correspondingTrack
            ? getPointOnTrackCoordinates(
                correspondingTrack.geo,
                correspondingTrack.length,
                location.offset
              )
            : null;

          if (!correspondingTrack || !coordinates) {
            // Can happen in case of track offset id does not exist in infra or
            // if its offset is greater than the track length
            newPathStepsMetadataById.set(pathStep.id, { isInvalid: true });
            return;
          }

          newPathStepsMetadataById.set(pathStep.id, {
            type: 'trackOffset',
            isInvalid: false,
            label: '',
            coordinates,
          });
          return;
        }
        // Find the matching operational point for this pathStep to get
        // its valid status and its name
        const matchedOp = allOps.find((op) => {
          if (location.operational_point.type === 'id') {
            return location.operational_point.operational_point === op.id;
          }
          if (location.operational_point.type === 'uic') {
            return (
              location.operational_point.uic === op.extensions?.identifier?.uic &&
              location.operational_point.secondary_code === op.extensions?.sncf?.ch
            );
          }
          return (
            location.operational_point.trigram === op.extensions?.sncf?.trigram &&
            location.operational_point.secondary_code === op.extensions?.sncf?.ch
          );
        });

        const trackRef = location.track_reference;
        const isValidTrackReference = trackRef
          ? matchedOp?.parts.some((part) => {
              const track = trackSectionsById[part.track];
              if (!track) return false;
              if ('track_name' in trackRef) {
                return trackRef.track_name === track.extensions?.sncf?.track_name;
              }
              return trackRef.track_id === track.id;
            })
          : true;

        // If no op is found or if its track_reference is invalid, it means the path step is invalid
        if (!isValidTrackReference || !matchedOp) {
          newPathStepsMetadataById.set(pathStep.id, { isInvalid: true });
          return;
        }

        const parts: Extract<PathStepMetadata, { isInvalid: false; type: 'opRef' }>['parts'] =
          matchedOp.parts.map((part) => {
            const correspondingTrack = trackSectionsById[part.track];
            return {
              trackId: correspondingTrack?.id ?? '',
              trackName: correspondingTrack?.extensions?.sncf?.track_name ?? '',
              coordinates: part.geo?.coordinates as Position,
            };
          });

        // Get the track name in case the path step has a track_reference with track_id
        let correspondingTrackName: string | undefined;
        if (location.track_reference) {
          correspondingTrackName =
            'track_name' in location.track_reference
              ? location.track_reference.track_name
              : trackSectionsById[location.track_reference.track_id]?.extensions?.sncf?.track_name;
        }

        newPathStepsMetadataById.set(pathStep.id, {
          type: 'opRef',
          isInvalid: false,
          name: matchedOp.extensions?.identifier?.name ?? '',
          uic: matchedOp.extensions?.identifier?.uic,
          secondaryCode: matchedOp.extensions?.sncf?.ch,
          trackName: correspondingTrackName,
          parts,
        });
      });

      setPathStepsMetadataById(newPathStepsMetadataById);
    };
    fetchAndSetMetadata();
  }, [allOps]);

  return { pathStepsMetadataById, setPathStepsMetadataById };
};
