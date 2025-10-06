import { useMemo } from 'react';

import { skipToken } from '@reduxjs/toolkit/query/react';
import { useSelector } from 'react-redux';

import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
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

  const { data: schedulePath } =
    osrdEditoastApi.endpoints.getTrainScheduleByIdPath.useQuery(scheduleArg);
  const { data: pacedPath } = osrdEditoastApi.endpoints.getPacedTrainByIdPath.useQuery(pacedArg);

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

  return useMemo(() => {
    if (pathfinding?.status !== 'success' || !pathProperties) {
      return undefined;
    }
    return {
      pathfinding,
      geometry: pathProperties.geometry,
      operationalPoints: pathProperties.operational_points,
    };
  }, [pathfinding, pathProperties]);
};

export default usePathProjection;
