import { useCallback } from 'react';

import { v4 as uuidV4 } from 'uuid';

import { useTimetableContext } from 'applications/operationalStudies/hooks/useTimetableContext';
import { updateTrainSchedule } from 'applications/operationalStudies/views/Scenario/components/ManageTrainSchedule/hooks/useUpdateTrainSchedule';
import type {
  PacedTrainException,
  PathItem,
  PathItemRelativeLocation,
  TrainSchedule,
} from 'common/api/osrdEditoastApi';
import type { PanelSelectionMode } from 'modules/simulationResult/components/SpaceTimeChartWrapper/CurveSelectionSidePanel';
import type {
  MovableOccupancyZone,
  DeployedWaypoint,
} from 'modules/simulationResult/components/SpaceTimeChartWrapper/helpers/zones';
import type { ProjectionWaypoint } from 'modules/simulationResult/types';
import {
  computeIndexedOccurrenceStartTime,
  extractOccurrenceDetailsFromPacedTrain,
  findTrainScheduleAndException,
  getOccurrenceTrainName,
  isPacedTrain,
  withPacedExceptions,
} from 'modules/trainSchedule/helpers/pacedTrain';
import {
  storeTrainSchedule,
  updateExceptions,
} from 'modules/trainSchedule/helpers/updateTrainScheduleHelpers';
import type { TrainScheduleWithDetails } from 'modules/trainSchedule/types';
import type { TrainId } from 'reducers/osrdconf/types';
import { useAppDispatch } from 'store';
import { Duration } from 'utils/duration';
import { extractOccurrenceIndexFromOccurrenceId, isOccurrenceId } from 'utils/trainId';

/**
 * Insert or update a path step to go through a specific track.
 */
function upsertPathStepTrack(
  path: PathItem[],
  op: ProjectionWaypoint,
  pathItemRelativeLocation: PathItemRelativeLocation,
  localTrackName: string | null
): PathItem[] {
  const newPath = [...path];

  // First check if the OP is already an explicit path step, if so update it
  if (pathItemRelativeLocation.type === 'exact_path_item') {
    const pathStepIndex = newPath.findIndex(
      (step) => step.id === pathItemRelativeLocation.path_item_id
    );
    if (pathStepIndex < 0) {
      throw new Error('Could not find path step to update');
    }

    const pathStep = newPath[pathStepIndex];
    if (pathStep.location.type === 'track_offset') {
      throw new Error('Cannot set local track name on a track offset OP part ref');
    }
    newPath[pathStepIndex] = {
      ...pathStep,
      location: {
        ...pathStep.location,
        local_track_name: localTrackName,
      },
    };
  } else {
    // Path step needs to be inserted

    const beforeIndex = newPath.findIndex(
      (step) => step.id === pathItemRelativeLocation.following_path_item_id
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
        local_track_name: localTrackName,
      },
    });
  }
  return newPath;
}

export default function useOccupancyZoneDrop({
  trainSchedulesWithDetails,
  pathOperationalPoints,
  deployedWaypoints,
  timetableId,
}: {
  trainSchedulesWithDetails: TrainScheduleWithDetails[];
  pathOperationalPoints: ProjectionWaypoint[];
  deployedWaypoints: DeployedWaypoint[];
  timetableId: number;
}) {
  const dispatch = useAppDispatch();
  const { trainSchedules, upsertTrainSchedules } = useTimetableContext();

  return useCallback(
    async (
      waypointId: string,
      trainId: TrainId,
      occupancyZone: MovableOccupancyZone,
      localTrackName: string | null,
      panelSelectionMode: PanelSelectionMode
    ) => {
      const { trainSchedule, exception } = findTrainScheduleAndException(
        trainSchedulesWithDetails,
        trainId
      );
      if (!trainSchedule) {
        throw new Error('Cannot find dropped train schedule in list');
      }

      const operationalPoint = pathOperationalPoints.find((op) => op.waypointId === waypointId)!;

      const path = exception?.path_and_schedule?.path ?? trainSchedule.path;
      const newPath = upsertPathStepTrack(
        path,
        operationalPoint,
        occupancyZone.pathItemRelativeLocation,
        localTrackName
      );

      if (isOccurrenceId(trainId)) {
        // Regarding the model: create, update, or delete this occurrence's exception.
        const rawTrainSchedule = trainSchedules.get(trainSchedule.id)!;
        if (!isPacedTrain(rawTrainSchedule)) {
          throw new Error(`Occurrence ID references a non-paced train ${rawTrainSchedule.id}`);
        }
        const { paced: _paced, ...occurrenceBaseTrain } = rawTrainSchedule;
        // Use the existing start_time override if there is one, otherwise compute this
        // occurrence's own.
        const occurrenceStartTime = exception?.start_time
          ? new Date(exception.start_time.value)
          : computeIndexedOccurrenceStartTime(
              new Date(rawTrainSchedule.start_time),
              Duration.parse(rawTrainSchedule.paced.interval),
              extractOccurrenceIndexFromOccurrenceId(trainId)
            );

        // TODO: updateTrainSchedule wasn't designed for TOD drag-and-drop. We have to
        // rebuild fields we don't have to change in the first place. A dedicated API (see
        // https://github.com/OpenRailAssociation/osrd/pull/17883/changes#r4016795469) would be
        // cleaner.
        const updatedOccurrence: TrainSchedule = {
          ...extractOccurrenceDetailsFromPacedTrain(occurrenceBaseTrain, exception),
          path: newPath,
          start_time: occurrenceStartTime.getTime(),
          train_name: getOccurrenceTrainName(rawTrainSchedule, trainId),
        };
        const result = await updateTrainSchedule({
          timetableId,
          trainScheduleId: rawTrainSchedule.id,
          originalTrainSchedule: trainSchedule,
          updatedTrainSchedule: updatedOccurrence,
          occurrenceId: trainId,
          addedExceptions: [],
          upsertTrainSchedules,
          dispatch,
        });
        if (!result.success) {
          throw new Error(`Invalid train schedule: ${result.errorCodes.join(', ')}`);
        }
      } else {
        // Reassign the track on the model, every compliant occurrence follows it automatically.
        const rawTrainSchedule = trainSchedules.get(trainSchedule.id)!;
        const updatedModel = await storeTrainSchedule(
          trainSchedule.id,
          { ...rawTrainSchedule, path: newPath },
          dispatch,
          upsertTrainSchedules
        );

        // 'all' mode also forces every occurrence with its own path_and_schedule exception
        // onto the new track.
        if (panelSelectionMode === 'all' && isPacedTrain(rawTrainSchedule)) {
          const updatedExceptions: PacedTrainException[] = rawTrainSchedule.paced.exceptions.map(
            (pacedException) =>
              pacedException.path_and_schedule
                ? {
                    ...pacedException,
                    path_and_schedule: {
                      ...pacedException.path_and_schedule,
                      path: upsertPathStepTrack(
                        pacedException.path_and_schedule.path,
                        operationalPoint,
                        occupancyZone.pathItemRelativeLocation,
                        localTrackName
                      ),
                    },
                  }
                : pacedException
          );
          const exceptionsToPersist = updatedExceptions.filter((e) => e.path_and_schedule);
          if (exceptionsToPersist.length) {
            await updateExceptions(dispatch, exceptionsToPersist, rawTrainSchedule.id);
            upsertTrainSchedules([withPacedExceptions(updatedModel, updatedExceptions)]);
          }
        }
      }
    },
    [
      trainSchedules,
      trainSchedulesWithDetails,
      pathOperationalPoints,
      deployedWaypoints,
      timetableId,
      dispatch,
      upsertTrainSchedules,
    ]
  );
}
