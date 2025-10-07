import { useEffect, useMemo, useState } from 'react';

import { skipToken } from '@reduxjs/toolkit/query';
import type { Position } from 'geojson';

import usePathOps from 'applications/operationalStudies/hooks/usePathOps';
import { useScenarioContext } from 'applications/operationalStudies/hooks/useScenarioContext';
import {
  osrdEditoastApi,
  type OperationalPointReference,
  type RelatedOperationalPoint,
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
        if ('uic' in step.location || 'trigram' in step.location) {
          // strip location from its secondary_code so we can have all matchs for an uic or trigram
          const {
            secondary_code: _secCode,
            track_reference: _trackRef,
            ...location
          } = step.location;
          acc.push({
            id: step.id,
            ...location,
          });
          return acc;
        }
        acc.push({
          id: step.id,
          ...step.location,
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
  const uicPayload: Extract<OperationalPointReference, { uic: number }>[] = useMemo(() => {
    const opIds = pathSteps.reduce<string[]>((acc, step) => {
      if (step.location && 'operational_point' in step.location) {
        acc.push(step.location.operational_point);
      }
      return acc;
    }, []);

    if (opIds.length === 0) return [];

    return pathStepsOperationalPoints.reduce<{ uic: number }[]>((acc, op) => {
      const uic = op.extensions?.identifier?.uic;
      if (uic && opIds.includes(op.id)) {
        acc.push({ uic });
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
      // and regroup ops by uic to easily get all secondary codes and track names for each path step
      const matchedTrackIds = new Set<string>();
      const opsByUic = new Map<number, RelatedOperationalPoint[]>();
      allOps.forEach((op) => {
        op.parts.forEach((part) => {
          matchedTrackIds.add(part.track);
        });
        const uic = op.extensions?.identifier?.uic;
        if (uic) {
          if (!opsByUic.has(uic)) {
            opsByUic.set(uic, [op]);
          } else {
            opsByUic.get(uic)!.push(op);
          }
        }
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
          const coordinates = getPointOnTrackCoordinates(
            correspondingTrack.geo,
            correspondingTrack.length,
            location.offset
          );
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
          if ('operational_point' in location) {
            return location.operational_point === op.id;
          }
          if ('uic' in location) {
            return (
              location.uic === op.extensions?.identifier?.uic &&
              location.secondary_code === op.extensions?.sncf?.ch
            );
          }
          return (
            location.trigram === op.extensions?.sncf?.trigram &&
            location.secondary_code === op.extensions?.sncf?.ch
          );
        });

        // If no op is found, it means the path step is invalid
        if (!matchedOp) {
          newPathStepsMetadataById.set(pathStep.id, { isInvalid: true });
          return;
        }

        // Get the ops with the same uic to get all its secondary codes and track names
        // to display in the form
        const opsWithSameUic = opsByUic.get(matchedOp.extensions?.identifier?.uic ?? -1) ?? [];

        const locationsBySecondaryCode: Extract<
          PathStepMetadata,
          { isInvalid: false; type: 'opRef' }
        >['locationsBySecondaryCode'] = new Map();

        opsWithSameUic.forEach((op) => {
          const metadata: {
            trackId: string;
            trackName: string;
            lineName: string;
            coordinates: Position;
          }[] = [];
          op.parts.forEach((part) => {
            const correspondingTrack = trackSectionsById[part.track];
            metadata.push({
              trackId: correspondingTrack?.id ?? '',
              trackName: correspondingTrack?.extensions?.sncf?.track_name ?? '',
              lineName: correspondingTrack?.extensions?.sncf?.line_name ?? '',
              coordinates: part.geo?.coordinates as Position,
            });
          });
          locationsBySecondaryCode.set(op.extensions?.sncf?.ch ?? '', metadata);
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
          locationsBySecondaryCode,
        });
      });

      setPathStepsMetadataById(newPathStepsMetadataById);
    };
    fetchAndSetMetadata();
  }, [allOps]);

  return { pathStepsMetadataById, setPathStepsMetadataById };
};
