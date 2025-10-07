import { useMemo } from 'react';

import { skipToken } from '@reduxjs/toolkit/query/react';
import { isEqual } from 'lodash';
import { useSelector } from 'react-redux';

import { osrdEditoastApi, type PathfindingResult } from 'common/api/osrdEditoastApi';
import { getExceptionFromOccurrenceId } from 'modules/timetableItem/helpers/pacedTrain';
import type { TimetableItemId, TimetableItem } from 'reducers/osrdconf/types';
import { getTrainIdUsedForProjection } from 'reducers/simulationResults/selectors';
import {
  extractEditoastIdFromPacedTrainId,
  extractEditoastIdFromTrainScheduleId,
  extractPacedTrainIdFromOccurrenceId,
  isPacedTrainId,
  isTrainScheduleId,
} from 'utils/trainId';

/**
 * Indicates whether two pathfinding results share the same status and simulated path (but not necessarily the same requested path steps).
 * This is useful in particular when projecting on an exception to know whether it shares the same simulated path as its original paced train.
 */
const pathfindingResultsDiffer = (
  pathfinding1: PathfindingResult | undefined,
  pathfinding2: PathfindingResult | undefined
): boolean | undefined => {
  if (!pathfinding1 || !pathfinding2) return undefined;
  if (pathfinding1.status !== pathfinding2.status) return true;
  if (pathfinding1.status !== 'success' || pathfinding2.status !== 'success') return false; // Slightly redundant check to help type narrowing
  return !isEqual(pathfinding1.path, pathfinding2.path);
};

const usePathProjection = (
  infraId: number,
  timetableItemsById: Map<TimetableItemId, TimetableItem>
) => {
  const trainIdUsedForProjection = useSelector(getTrainIdUsedForProjection);

  let rawTrainScheduleId: number | undefined;
  let rawPacedTrainId: number | undefined;
  let exceptionKey: string | undefined;
  if (trainIdUsedForProjection) {
    if (isTrainScheduleId(trainIdUsedForProjection)) {
      rawTrainScheduleId = extractEditoastIdFromTrainScheduleId(trainIdUsedForProjection);
    } else if (isPacedTrainId(trainIdUsedForProjection)) {
      rawPacedTrainId = extractEditoastIdFromPacedTrainId(trainIdUsedForProjection);
    } else {
      const pacedTrainId = extractPacedTrainIdFromOccurrenceId(trainIdUsedForProjection);
      rawPacedTrainId = extractEditoastIdFromPacedTrainId(pacedTrainId);
      exceptionKey = getExceptionFromOccurrenceId(
        timetableItemsById,
        trainIdUsedForProjection
      )?.key;
    }
  }

  const scheduleArg = rawTrainScheduleId ? { id: rawTrainScheduleId, infraId } : skipToken;
  const pacedArg = rawPacedTrainId ? { id: rawPacedTrainId, infraId, exceptionKey } : skipToken;
  const basePacedArg = exceptionKey ? { id: rawPacedTrainId!, infraId } : skipToken;

  const { data: schedulePath } =
    osrdEditoastApi.endpoints.getTrainScheduleByIdPath.useQuery(scheduleArg);
  const { data: pacedPath } = osrdEditoastApi.endpoints.getPacedTrainByIdPath.useQuery(pacedArg);
  const { currentData: basePacedPath } =
    osrdEditoastApi.endpoints.getPacedTrainByIdPath.useQuery(basePacedArg);

  const pathfinding = rawTrainScheduleId ? schedulePath : pacedPath;

  const { data: pathProperties } =
    osrdEditoastApi.endpoints.postInfraByInfraIdPathProperties.useQuery(
      pathfinding?.status === 'success'
        ? {
            infraId,
            pathPropertiesInput: { track_section_ranges: pathfinding.path.track_section_ranges },
          }
        : skipToken
    );

  const projectingOnSimulatedPathException = pathfindingResultsDiffer(basePacedPath, pacedPath);

  return useMemo(() => {
    if (pathfinding?.status !== 'success' || !pathProperties) {
      return undefined;
    }
    return {
      pathfinding,
      geometry: pathProperties.geometry,
      operationalPoints: pathProperties.operational_points,
      projectingOnSimulatedPathException,
    };
  }, [pathfinding, pathProperties]);
};

export default usePathProjection;
