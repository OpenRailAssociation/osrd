import { useCallback } from 'react';

import type { Track } from '@osrd-project/ui-charts';
import { v4 as uuidV4 } from 'uuid';

import {
  osrdEditoastApi,
  type PathAndScheduleChangeGroup,
  type PathItem,
  type TrainScheduleExceptionChangeGroups,
  type TrainScheduleResponse,
} from 'common/api/osrdEditoastApi';
import { matchPathStepAndOp } from 'modules/pathfinding/utils';
import type { MovableOccupancyZone } from 'modules/simulationResult/components/SpaceTimeChartWrapper/helpers/zones';
import type { DeployedWaypoint } from 'modules/simulationResult/components/SpaceTimeChartWrapper/useTrackOccupancy';
import type { PathOperationalPoint } from 'modules/simulationResult/types';
import { findTrainScheduleAndException } from 'modules/trainSchedule/helpers/pacedTrain';
import { storeTrainSchedule } from 'modules/trainSchedule/helpers/updateTrainScheduleHelpers';
import type {
  TrainScheduleWithDetails,
  SimulatedException,
  SimulationSummary,
} from 'modules/trainSchedule/types';
import type { TrainId } from 'reducers/osrdconf/types';
import { useAppDispatch } from 'store';
import { Duration } from 'utils/duration';

/**
 * Insert or update a path step to go through a specific track.
 */
function upsertPathStepTrack(
  path: PathItem[],
  simulationSummary: SimulationSummary | undefined,
  op: PathOperationalPoint,
  occupancyZoneStartOffset: Duration,
  trackName: string
): PathItem[] {
  // First check if the OP is already an explicit path step, if so update it
  // TODO: better matching, e.g. by making the backend return the path step ID
  // for each PathOperationalPoint
  const pathStepIndex = path.findIndex((step) =>
    matchPathStepAndOp(step.location, {
      // If the OP is not found in the infrastructure, OP ID may be null
      opId: op.opId ?? undefined,
      uic: op.uic,
      secondaryCode: op.secondary_code,
      mainCode: op.main_code,
      // Never match by track/offset: we're switching the track
      track: '',
      offsetOnTrack: NaN,
    })
  );

  const newPath = [...path];
  if (pathStepIndex >= 0) {
    const pathStep = newPath[pathStepIndex];
    if (pathStep.location.type === 'track_offset') {
      throw new Error('Cannot set local track name on a track offset OP part ref');
    }
    newPath[pathStepIndex] = {
      ...pathStep,
      location: {
        ...pathStep.location,
        local_track_name: trackName,
      },
    };
  } else {
    // Path step needs to be inserted

    // If a train is not simulated, it only goes through OPs found in path
    // steps, so this situation should never happen
    if (!simulationSummary?.isValid) {
      throw new Error('Need a simulation summary when OP is not found in path steps');
    }

    // TODO: better matching, e.g. by making the backend return the previous
    // path step ID for each occupancy zone
    const beforeIndex = simulationSummary.pathItemTimes.final.findIndex(
      (t) => t > occupancyZoneStartOffset.ms
    );
    if (beforeIndex < 0) {
      throw new Error('Could not find where to insert new path step');
    } else if (beforeIndex === 0) {
      throw new Error('Cannot replace origin');
    }

    newPath.splice(beforeIndex, 0, {
      id: uuidV4(),
      location: {
        type: 'operational_point_part_reference',
        operational_point: {
          // TODO: switch to trigram once international OP model work is done
          type: 'id',
          // OP ID is never null because pathfinding succeeded
          operational_point: op.opId!,
        },
        local_track_name: trackName,
      },
    });
  }
  return newPath;
}

export default function useOccupancyZoneDrop({
  trainSchedules,
  trainSchedulesWithDetails,
  pathOperationalPoints,
  deployedWaypoints,
  upsertTrainSchedules,
}: {
  trainSchedules: TrainScheduleResponse[];
  trainSchedulesWithDetails: TrainScheduleWithDetails[];
  pathOperationalPoints: PathOperationalPoint[];
  deployedWaypoints: DeployedWaypoint[];
  upsertTrainSchedules: (trainSchedules: TrainScheduleResponse[]) => void;
}) {
  const dispatch = useAppDispatch();

  const [putException] = osrdEditoastApi.endpoints.putTrainScheduleExceptionById.useMutation();

  const updateExceptionPath = useCallback(
    async (
      exception: SimulatedException,
      trainSchedule: TrainScheduleWithDetails,
      newPath: PathItem[]
    ) => {
      const { id, summary: _summary, occurrence_index, disabled, ...changeGroups } = exception;

      // If the exception already has a path_and_schedule change group, update
      // it. Otherwise create it (copying over the base train schedule's path
      // and schedule).
      const pathAndSchedule: PathAndScheduleChangeGroup = changeGroups.path_and_schedule ?? {
        path: trainSchedule.path,
        schedule: trainSchedule.schedule ?? [],
        margins: trainSchedule.margins ?? {
          boundaries: [],
          values: [],
        },
        power_restrictions: trainSchedule.power_restrictions ?? [],
      };
      const updatedChangeGroups: TrainScheduleExceptionChangeGroups = {
        ...changeGroups,
        path_and_schedule: {
          ...pathAndSchedule,
          path: newPath,
        },
      };

      await putException({
        // TODO: remove this null assertion once exception migration is done
        id: id!,
        body: {
          occurrence_index,
          disabled: disabled ?? false,
          change_groups: updatedChangeGroups,
          train_schedule_id: trainSchedule.id,
        },
      }).unwrap();

      const rawTrainSchedule = trainSchedules.find((ts) => ts.id === trainSchedule.id)!;
      upsertTrainSchedules([
        {
          ...rawTrainSchedule,
          paced: {
            ...rawTrainSchedule.paced!,
            exceptions: rawTrainSchedule.paced!.exceptions.map((ex) =>
              ex.id === id ? { ...ex, change_groups: updatedChangeGroups } : ex
            ),
          },
        },
      ]);
    },
    [putException, trainSchedules]
  );

  return useCallback(
    async (
      waypointId: string,
      trainId: TrainId,
      occupancyZone: MovableOccupancyZone,
      track: Track
    ) => {
      const occupancyZoneStartTime = new Date(occupancyZone.startTime);

      const { trainSchedule, exception } = findTrainScheduleAndException(
        trainSchedulesWithDetails,
        trainId
      );
      if (!trainSchedule) {
        throw new Error('Cannot find dropped train schedule in list');
      }

      const operationalPoint = pathOperationalPoints.find((op) => op.waypointId === waypointId)!;

      const path = exception?.path_and_schedule?.path ?? trainSchedule.path;
      const simulationSummary = exception?.summary ?? trainSchedule.summary;
      const occupancyZoneStartOffset = Duration.subtractDate(
        occupancyZoneStartTime,
        trainSchedule.startTime
      );
      const newPath = upsertPathStepTrack(
        path,
        simulationSummary,
        operationalPoint,
        occupancyZoneStartOffset,
        track.name!
      );

      if (exception) {
        await updateExceptionPath(exception, trainSchedule, newPath);
      } else {
        const rawTrainSchedule = trainSchedules.find((ts) => ts.id === trainSchedule.id)!;
        const updatedTrainSchedule = {
          ...rawTrainSchedule,
          path: newPath,
        };
        await storeTrainSchedule(
          trainSchedule.id,
          updatedTrainSchedule,
          dispatch,
          upsertTrainSchedules
        );
      }
    },
    [
      trainSchedules,
      trainSchedulesWithDetails,
      pathOperationalPoints,
      deployedWaypoints,
      dispatch,
      upsertTrainSchedules,
      updateExceptionPath,
    ]
  );
}
