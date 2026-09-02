import { useCallback } from 'react';

import type { Track } from '@osrd-project/ui-charts';
import { v4 as uuidV4 } from 'uuid';

import { useTimetableContext } from 'applications/operationalStudies/hooks/useTimetableContext';
import type { PacedTrainResponse } from 'applications/operationalStudies/types';
import {
  buildOccurrenceExceptionData,
  checkChangeGroups,
  updatePacedTrainExceptionsList,
} from 'applications/operationalStudies/views/Scenario/components/ManageTrainSchedule/helpers/buildPacedTrainException';
import type { PacedTrainException, PathItem, TrainSchedule } from 'common/api/osrdEditoastApi';
import { matchPathStepAndOp } from 'modules/pathfinding/utils';
import type { PanelSelectionMode } from 'modules/simulationResult/components/SpaceTimeChartWrapper/CurveSelectionSidePanel';
import type {
  MovableOccupancyZone,
  DeployedWaypoint,
} from 'modules/simulationResult/components/SpaceTimeChartWrapper/helpers/zones';
import type { ProjectionWaypoint } from 'modules/simulationResult/types';
import {
  computeIndexedOccurrenceStartTime,
  extractOccurrenceDetailsFromPacedTrain,
  findExceptionWithOccurrenceId,
  findTrainScheduleAndException,
  getOccurrenceTrainName,
  isPacedTrain,
  isPacedTrainWithDetails,
  withPacedExceptions,
} from 'modules/trainSchedule/helpers/pacedTrain';
import {
  deleteExceptions,
  storeTrainSchedule,
  syncOccurrenceException,
  updateExceptions,
} from 'modules/trainSchedule/helpers/updateTrainScheduleHelpers';
import type { TrainScheduleWithDetails, SimulationSummary } from 'modules/trainSchedule/types';
import type { TrainId } from 'reducers/osrdconf/types';
import { useAppDispatch } from 'store';
import { Duration, startTimeToDate } from 'utils/duration';
import {
  extractOccurrenceIndexFromOccurrenceId,
  formatTrainScheduleIdToOccurrenceId,
  isOccurrenceId,
} from 'utils/trainId';

/**
 * Insert or update a path step to go through a specific track.
 */
function upsertPathStepTrack(
  path: PathItem[],
  simulationSummary: SimulationSummary | undefined,
  op: ProjectionWaypoint,
  occupancyZoneStartOffset: Duration,
  trackName: string
): PathItem[] {
  // First check if the OP is already an explicit path step, if so update it
  // TODO: better matching, e.g. by making the backend return the path step ID
  // for each ProjectionWaypoint
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

/**
 * Use the existing start_time override if there is one, otherwise compute the
 * occurrence's own.
 */
function getOccurrenceStartTime(
  rawTrainSchedule: PacedTrainResponse,
  startTimeOverride: PacedTrainException['start_time'],
  getOccurrenceIndex: () => number
): Date {
  return startTimeOverride
    ? new Date(startTimeOverride.value)
    : computeIndexedOccurrenceStartTime(
        new Date(rawTrainSchedule.start_time),
        Duration.parse(rawTrainSchedule.paced.interval),
        getOccurrenceIndex()
      );
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
      track: Track,
      panelSelectionMode: PanelSelectionMode
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
        // TODO Hourly timetables: use the actual start time instead of a fictive date
        startTimeToDate(trainSchedule.startTime)
      );
      const newPath = upsertPathStepTrack(
        path,
        simulationSummary,
        operationalPoint,
        occupancyZoneStartOffset,
        track.name!
      );

      if (isOccurrenceId(trainId)) {
        // Regarding the model: create, update, or delete this occurrence's exception.
        const rawTrainSchedule = trainSchedules.get(trainSchedule.id)!;
        if (!isPacedTrain(rawTrainSchedule)) {
          throw new Error(`Occurrence ID references a non-paced train ${rawTrainSchedule.id}`);
        }
        const { paced: _paced, ...occurrenceBaseTrain } = rawTrainSchedule;
        const occurrenceStartTime = getOccurrenceStartTime(
          rawTrainSchedule,
          exception?.start_time,
          () => extractOccurrenceIndexFromOccurrenceId(trainId)
        );
        const updatedOccurrence: TrainSchedule = {
          ...extractOccurrenceDetailsFromPacedTrain(occurrenceBaseTrain, exception),
          path: newPath,
          start_time: occurrenceStartTime.getTime(),
          train_name: getOccurrenceTrainName(rawTrainSchedule, trainId),
        };
        const {
          generatedException,
          existingException: exceptionToSync,
          occurrenceIndex,
        } = buildOccurrenceExceptionData(rawTrainSchedule, updatedOccurrence, trainId);
        const finalException = await syncOccurrenceException(
          dispatch,
          generatedException,
          exceptionToSync,
          occurrenceIndex,
          rawTrainSchedule.id,
          timetableId
        );
        const updatedExceptions = updatePacedTrainExceptionsList(
          rawTrainSchedule.paced.exceptions,
          finalException,
          trainId
        );
        upsertTrainSchedules([withPacedExceptions(rawTrainSchedule, updatedExceptions)]);
      } else {
        // Reassign the track on the model, every compliant occurrence follows it automatically.
        const rawTrainSchedule = trainSchedules.get(trainSchedule.id)!;
        const updatedModelTrainSchedule = { ...rawTrainSchedule, path: newPath };

        if (!isPacedTrain(rawTrainSchedule)) {
          await storeTrainSchedule(
            trainSchedule.id,
            updatedModelTrainSchedule,
            dispatch,
            upsertTrainSchedules
          );
          return;
        }
        if (!isPacedTrainWithDetails(trainSchedule)) {
          throw new Error(`Train schedule ${trainSchedule.id} references a non-paced train`);
        }

        // 'all' mode also forces every occurrence with its own path_and_schedule exception
        // onto the new track (only the ones whose own path contains this waypoint).
        const waypointZones = deployedWaypoints.find((wp) => wp.waypointId === waypointId)?.zones;
        const movedExceptions: PacedTrainException[] =
          panelSelectionMode === 'all'
            ? rawTrainSchedule.paced.exceptions.map((pacedException) => {
                if (!pacedException.path_and_schedule || pacedException.disabled) {
                  return pacedException;
                }

                const occurrenceId = formatTrainScheduleIdToOccurrenceId(trainId, pacedException);
                const occurrenceZone = waypointZones?.find((zone) => zone.trainId === occurrenceId);
                if (!occurrenceZone) {
                  // We don't move this occurrence. Its own path doesn't contain the dragged waypoint.
                  return pacedException;
                }

                const occurrenceOwnStartTime = getOccurrenceStartTime(
                  rawTrainSchedule,
                  pacedException.start_time,
                  () => pacedException.occurrence_index!
                );
                const occurrenceOffset = Duration.subtractDate(
                  new Date(occurrenceZone.startTime),
                  occurrenceOwnStartTime
                );
                const occurrenceSummary =
                  findExceptionWithOccurrenceId(trainSchedule.paced.exceptions, occurrenceId)
                    ?.summary ?? trainSchedule.summary;

                return {
                  ...pacedException,
                  path_and_schedule: {
                    ...pacedException.path_and_schedule,
                    path: upsertPathStepTrack(
                      pacedException.path_and_schedule.path,
                      occurrenceSummary,
                      operationalPoint,
                      occurrenceOffset,
                      track.name!
                    ),
                  },
                };
              })
            : rawTrainSchedule.paced.exceptions;

        // Clear exceptions that no longer differ from the updated model.
        const {
          exceptions: reconciledExceptions,
          modifiedExceptions: exceptionsToUpdate,
          exceptionsToDeleteIds,
        } = checkChangeGroups(updatedModelTrainSchedule, rawTrainSchedule.paced, movedExceptions);

        if (exceptionsToDeleteIds.length) {
          await deleteExceptions(dispatch, exceptionsToDeleteIds);
        }
        if (exceptionsToUpdate.length) {
          await updateExceptions(dispatch, exceptionsToUpdate, rawTrainSchedule.id);
        }

        await storeTrainSchedule(
          trainSchedule.id,
          {
            ...updatedModelTrainSchedule,
            paced: { ...rawTrainSchedule.paced, exceptions: reconciledExceptions },
          },
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
      timetableId,
      dispatch,
      upsertTrainSchedules,
    ]
  );
}
