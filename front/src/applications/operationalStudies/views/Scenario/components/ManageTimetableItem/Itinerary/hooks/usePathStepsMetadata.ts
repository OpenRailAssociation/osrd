import { useEffect, useMemo, useState } from 'react';

import type { Position } from 'geojson';
import { v4 as uuid } from 'uuid';

import usePathOps from 'applications/operationalStudies/hooks/usePathOps';
import { useScenarioContext } from 'applications/operationalStudies/hooks/useScenarioContext';
import type { TrainSchedule } from 'common/api/osrdEditoastApi';
import type { PathStepMetadata, PathStepV2 } from 'reducers/osrdconf/types';
import { getPointOnTrackCoordinates } from 'utils/geometry';
import { mToMm } from 'utils/physics';

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
  const trainPath: TrainSchedule['path'] = useMemo(
    () =>
      pathSteps.reduce<TrainSchedule['path']>((acc, step) => {
        if (step.location) {
          acc.push({
            id: step.id,
            location: step.location,
          });
        }
        return acc;
      }, []),
    [pathSteps]
  );

  const pathStepsOperationalPoints = usePathOps(infraId, trainPath, {
    ignoreSecondaryCode: true,
  });

  // 2. Since a path step containing 'operational_point' as location will have only one match
  // with postInfraByInfraIdMatchOperationalPoints, we need to call the endpoint again with
  // the opId corresponding uic in order to get all the possible matches and have
  // all the secondary codes and track names
  const uicTrainPath: TrainSchedule['path'] = useMemo(() => {
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

    return pathStepsOperationalPoints
      .filter((op) => op.extensions?.identifier?.uic)
      .map((op) => ({
        // The step id is required by the type but ignored by usePathOps
        id: uuid(),
        location: {
          operational_point: {
            type: 'uic' as const,
            uic: op.extensions!.identifier!.uic,
          },
        },
      }));
  }, [pathSteps, pathStepsOperationalPoints]);

  const allOpIdsOperationalPoints = usePathOps(infraId, uicTrainPath, {
    ignoreSecondaryCode: true,
  });

  // 3. Merge both operational points lists to have all possible matches
  const allOps = useMemo(
    () => [...pathStepsOperationalPoints, ...allOpIdsOperationalPoints],
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
        // TODO : we need to evaluate if we still need to invalidate a pathstep when it has no location
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
                mToMm(correspondingTrack.length),
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

        const { local_track_name } = location;
        const isValidLocalTrackName = local_track_name
          ? matchedOp?.parts.some((part) => {
              const track = trackSectionsById[part.track];
              if (!track) return false;
              return local_track_name === part.local_track_name;
            })
          : true;

        // If no op is found or if its local_track_name is invalid, it means the path step is invalid
        if (!isValidLocalTrackName || !matchedOp) {
          newPathStepsMetadataById.set(pathStep.id, { isInvalid: true });
          return;
        }

        const parts: Extract<PathStepMetadata, { isInvalid: false; type: 'opRef' }>['parts'] =
          matchedOp.parts.map((part) => ({
            trackId: part.track,
            trackName: part.local_track_name,
            coordinates: part.geo?.coordinates as Position,
          }));

        newPathStepsMetadataById.set(pathStep.id, {
          type: 'opRef',
          isInvalid: false,
          name: matchedOp.extensions?.identifier?.name ?? '',
          uic: matchedOp.extensions?.identifier?.uic,
          secondaryCode: matchedOp.extensions?.sncf?.ch,
          trackName: local_track_name ?? undefined,
          parts,
        });
      });

      setPathStepsMetadataById(newPathStepsMetadataById);
    };
    fetchAndSetMetadata();
  }, [allOps, pathSteps]);

  return { pathStepsMetadataById, setPathStepsMetadataById };
};
