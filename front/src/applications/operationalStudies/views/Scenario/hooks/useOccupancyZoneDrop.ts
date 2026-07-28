import { useCallback } from 'react';

import type { Track } from '@osrd-project/ui-charts';
import { v4 as uuidV4 } from 'uuid';

import { useTimetableContext } from 'applications/operationalStudies/hooks/useTimetableContext';
import {
  buildOccurrenceExceptionData,
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
  findTrainScheduleAndException,
  getOccurrenceTrainName,
  isPacedTrain,
  withPacedExceptions,
} from 'modules/trainSchedule/helpers/pacedTrain';
import {
  storeTrainSchedule,
  syncOccurrenceException,
  updateExceptions,
} from 'modules/trainSchedule/helpers/updateTrainScheduleHelpers';
import type { TrainScheduleWithDetails, SimulationSummary } from 'modules/trainSchedule/types';
import type { TrainId } from 'reducers/osrdconf/types';
import { useAppDispatch } from 'store';
import { Duration, startTimeToDate } from 'utils/duration';
import { extractOccurrenceIndexFromOccurrenceId, isOccurrenceId } from 'utils/trainId';

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
        // Use the existing start_time override if there is one, otherwise compute this
        // occurrence's own.
        const occurrenceStartTime = exception?.start_time
          ? new Date(exception.start_time.value)
          : computeIndexedOccurrenceStartTime(
              new Date(rawTrainSchedule.start_time),
              Duration.parse(rawTrainSchedule.paced.interval),
              extractOccurrenceIndexFromOccurrenceId(trainId)
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
                        simulationSummary,
                        operationalPoint,
                        occupancyZoneStartOffset,
                        track.name!
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
