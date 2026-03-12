import { useEffect, useMemo, useState, type RefObject } from 'react';

import type { Position } from 'geojson';

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
export const usePathStepsMetadata = (
  pathSteps: PathStepV2[],
  pendingStepIdRef: RefObject<string>
) => {
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

  // 2. Fetch OPs for each path step
  const pathStepsOperationalPoints = usePathOps(infraId, trainPath);

  useEffect(() => {
    const fetchAndSetMetadata = async () => {
      // 3. Get all track ids of all matched operational points to get all tracks metadata
      const matchedTrackIds = new Set<string>();
      [...pathStepsOperationalPoints.values()].flat().forEach((op) => {
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

      // 4. Loop of the path steps to build the metadata map
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
        const matchedOp = pathStepsOperationalPoints.get(pathStep.id)?.at(0);

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
      const pendingStepId = pendingStepIdRef?.current;

      if (pendingStepId) {
        const metadata = newPathStepsMetadataById.get(pendingStepId);
        if (metadata && !metadata.isInvalid) {
          pendingStepIdRef.current = '';
        }
      }
      setPathStepsMetadataById(newPathStepsMetadataById);
    };
    fetchAndSetMetadata();
  }, [pathStepsOperationalPoints, pathSteps]);

  return { pathStepsMetadataById, setPathStepsMetadataById };
};
