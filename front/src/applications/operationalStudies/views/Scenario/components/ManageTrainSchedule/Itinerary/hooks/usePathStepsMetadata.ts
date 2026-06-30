import { useCallback, useEffect, useMemo, useState, type RefObject } from 'react';

import { skipToken } from '@reduxjs/toolkit/query';
import type { Position } from 'geojson';

import usePathOps from 'applications/operationalStudies/hooks/usePathOps';
import { useScenarioContext } from 'applications/operationalStudies/hooks/useScenarioContext';
import {
  osrdEditoastApi,
  type OperationalPointReference,
  type TrainSchedule,
} from 'common/api/osrdEditoastApi';
import type { PathStepMetadata, PathStepV2 } from 'reducers/osrdconf/types';
import { getPointOnTrackCoordinates } from 'utils/geometry';
import { mToMm } from 'utils/physics';

/**
 * Generates a unique key for an OperationalPointReference.
 */
const getOpRefKey = (opRef: OperationalPointReference): string => {
  switch (opRef.type) {
    case 'trigram':
      return `trigram:${opRef.trigram}:${opRef.secondary_code ?? ''}`;
    case 'uic':
      return `uic:${opRef.uic}:${opRef.secondary_code ?? ''}`;
    case 'id':
      return `id:${opRef.operational_point}`;
    default:
      return '';
  }
};

/**
 * For each path step, get all its secondary codes and track names to display in the form
 * and update the pathStepsMetadataById state.
 */
export const usePathStepsMetadata = (
  pathSteps: PathStepV2[],
  pendingStepIdRef: RefObject<string>
) => {
  const { infraId, timetableId, getTrackSectionsByIds } = useScenarioContext();

  const [pathStepsMetadataById, setPathStepsMetadataById] = useState<Map<string, PathStepMetadata>>(
    new Map()
  );

  // Build the opRefsByKey map to query local track names from the timetable
  const opRefsByKey = useMemo(() => {
    const result: Record<string, OperationalPointReference> = {};
    pathSteps.forEach((step) => {
      if (!step.location || step.location.type !== 'operational_point_part_reference') return;
      const { operational_point: opRef } = step.location;
      const key = getOpRefKey(opRef);
      if (key && !result[key]) result[key] = opRef;
    });
    return result;
  }, [pathSteps]);

  const hasOpRefs = Object.keys(opRefsByKey).length > 0;

  // Fetch local track names used by other trains in the timetable
  const { data: localTrackNamesData } =
    osrdEditoastApi.endpoints.postTimetableByIdPathStepsLocalTrackNames.useQuery(
      hasOpRefs && infraId
        ? {
            id: timetableId,
            body: { infra_id: infraId, operational_point_references: opRefsByKey },
          }
        : skipToken
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
      [...pathStepsOperationalPoints.values()].forEach((op) => {
        op?.parts.forEach((part) => {
          matchedTrackIds.add(part.track);
        });
      });
      const allTrackIds = Array.from(matchedTrackIds);

      // Add requested points track ids
      pathSteps.forEach(
        (step) =>
          step.location &&
          step.location.type === 'track_offset' &&
          allTrackIds.push(step.location.track)
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

        if (location.type === 'track_offset') {
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
        const matchedOp = pathStepsOperationalPoints.get(pathStep.id);

        const { local_track_name } = location;

        if (!matchedOp) {
          // A just-added step has no match until /match_operational_points
          // answers; keep its pre-filled metadata instead of flagging it
          const previous = pathStepsMetadataById.get(pathStep.id);
          if (previous && !previous.isInvalid && previous.type === 'opRef') {
            newPathStepsMetadataById.set(pathStep.id, previous);
            return;
          }

          const opRefKey = getOpRefKey(location.operational_point);
          const timetableTrackNames = localTrackNamesData?.[opRefKey] ?? [];

          newPathStepsMetadataById.set(pathStep.id, {
            isInvalid: true,
            localTrackName: local_track_name ?? undefined,
            customTrackNames: timetableTrackNames.length > 0 ? timetableTrackNames : undefined,
          });
          return;
        }

        const opRefKey = getOpRefKey(location.operational_point);
        const timetableTrackNames = localTrackNamesData?.[opRefKey] ?? [];

        const isValidLocalTrackName = local_track_name
          ? matchedOp.parts.some((part) => {
              const track = trackSectionsById[part.track];
              if (!track) return false;
              return local_track_name === part.local_track_name;
            })
          : true;

        const validParts: Extract<PathStepMetadata, { isInvalid: false; type: 'opRef' }>['parts'] =
          matchedOp.parts.map((part) => ({
            type: 'valid' as const,
            trackId: part.track,
            trackName: part.local_track_name,
            coordinates: part.geo?.coordinates as Position,
          }));

        const existingTrackNames = new Set(validParts.map((p) => p.trackName));
        const customParts: Extract<PathStepMetadata, { isInvalid: false; type: 'opRef' }>['parts'] =
          timetableTrackNames
            .filter((name) => !existingTrackNames.has(name))
            .map((name) => ({ type: 'custom' as const, trackName: name }));

        const parts = [...validParts, ...customParts];

        newPathStepsMetadataById.set(pathStep.id, {
          type: 'opRef',
          isInvalid: false,
          name: matchedOp.name,
          uic: matchedOp.uic,
          secondaryCode: matchedOp.secondary_code,
          trackName: local_track_name ?? undefined,
          isValidLocalTrackName,
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
  }, [pathStepsOperationalPoints, pathSteps, localTrackNamesData]);

  const setPathStepMetadata = useCallback(
    (id: string, metadata: PathStepMetadata) =>
      setPathStepsMetadataById((prev) => new Map(prev).set(id, metadata)),
    []
  );

  return { pathStepsMetadataById, setPathStepMetadata };
};
