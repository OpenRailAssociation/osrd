import { useCallback } from 'react';

import { useSelector } from 'react-redux';

import { updatePacedTrainExceptionsList } from 'applications/operationalStudies/views/Scenario/components/ManageTrainSchedule/helpers/buildPacedTrainException';
import { formatPacedTrainWithDetailsToTrainSchedule } from 'applications/operationalStudies/views/Scenario/components/ManageTrainSchedule/helpers/formatTrainSchedulePayload';
import type {
  PacedTrainException,
  TrainSchedule,
  TrainScheduleResponse,
} from 'common/api/osrdEditoastApi';
import {
  findExceptionWithOccurrenceId,
  extractOccurrenceDetailsFromPacedTrain,
  hasChangeGroups,
} from 'modules/trainSchedule/helpers/pacedTrain';
import {
  createExceptions,
  deleteExceptions,
  updateExceptions,
} from 'modules/trainSchedule/helpers/updateTrainScheduleHelpers';
import type {
  Occurrence,
  PacedTrainWithPacedWithDetails,
  SimulatedException,
} from 'modules/trainSchedule/types';
import type { OccurrenceId } from 'reducers/osrdconf/types';
import { updateSelectedTrain, updateTrainIdUsedForProjection } from 'reducers/simulationResults';
import { getSelectedTrain } from 'reducers/simulationResults/selectors';
import { useAppDispatch } from 'store';
import { extractExceptionIdFromOccurrenceId, isIndexedOccurrenceId } from 'utils/trainId';

type OccurrenceActionsParams = {
  pacedTrain: PacedTrainWithPacedWithDetails;
  occurrences: Occurrence[];
  selectPacedTrainToEdit: (
    pacedTrainToEdit: PacedTrainWithPacedWithDetails,
    originalPacedTrain?: PacedTrainWithPacedWithDetails,
    occurrenceId?: OccurrenceId
  ) => void;
  upsertTrainSchedules: (trainSchedules: TrainScheduleResponse[]) => void;
  timetableId: number;
};

const useOccurrenceActions = ({
  pacedTrain,
  occurrences,
  selectPacedTrainToEdit,
  upsertTrainSchedules,
  timetableId,
}: OccurrenceActionsParams) => {
  const dispatch = useAppDispatch();

  const { id: selectedTrainId } = useSelector(getSelectedTrain) || {};

  const upsertWithNewExceptions = useCallback(
    (newExceptions: SimulatedException[]) => {
      const formattedPacedTrain = formatPacedTrainWithDetailsToTrainSchedule(pacedTrain);

      upsertTrainSchedules([
        {
          ...formattedPacedTrain,
          id: pacedTrain.id,
          train_schedule_set_id: pacedTrain.train_schedule_set_id,
          paced: formattedPacedTrain.paced
            ? { ...formattedPacedTrain.paced, exceptions: newExceptions }
            : undefined,
        },
      ]);
    },
    [pacedTrain, upsertTrainSchedules]
  );

  const toggleOccurrenceSelection = useCallback(
    (occurrenceId: OccurrenceId) => {
      dispatch(
        updateSelectedTrain(
          occurrenceId === selectedTrainId ? undefined : { id: occurrenceId, by: 'timetable' }
        )
      );
    },
    [dispatch, selectedTrainId]
  );

  const selectOccurrenceForProjection = useCallback((occurrenceId: OccurrenceId) => {
    dispatch(updateTrainIdUsedForProjection(occurrenceId));
  }, []);

  // We build a new train schedule to edit with the current paced train modified with
  // the occurrence start time and all its eventual exceptions
  const editOccurrence = useCallback(
    async (editedOccurrence: Occurrence) => {
      let occurrenceWithDetails: PacedTrainWithPacedWithDetails = pacedTrain;

      const occurrenceToUpdateException = findExceptionWithOccurrenceId(
        pacedTrain.paced.exceptions,
        editedOccurrence.id
      );

      const rawPacedTrain: Omit<TrainSchedule, 'paced'> = {
        ...pacedTrain,
        train_name: editedOccurrence.trainName,
        speed_limit_tag: pacedTrain.speedLimitTag,
        rolling_stock_name: editedOccurrence.rollingStock?.name || '',
        start_time: editedOccurrence.startTime.getTime(),
      };

      const {
        train_name,
        start_time,
        speed_limit_tag,
        rolling_stock_name: _rollingStockName,
        ...occurrenceProps
      } = extractOccurrenceDetailsFromPacedTrain(rawPacedTrain, occurrenceToUpdateException);

      occurrenceWithDetails = {
        ...pacedTrain,
        ...occurrenceProps,
        name: train_name,
        startTime: new Date(start_time),
        speedLimitTag: speed_limit_tag ?? null,
        rollingStock: editedOccurrence.rollingStock,
      };

      selectPacedTrainToEdit(occurrenceWithDetails, pacedTrain, editedOccurrence.id);
    },
    [pacedTrain, selectPacedTrainToEdit]
  );

  const updateOccurrenceStatus = useCallback(
    async (occurrence: Occurrence, status: 'disabled' | 'enable') => {
      const occurrenceToUpdateException = findExceptionWithOccurrenceId(
        pacedTrain.paced.exceptions,
        occurrence.id
      );

      let exceptionsToUpdate: PacedTrainException;

      if (occurrenceToUpdateException) {
        const updatedException = {
          ...occurrenceToUpdateException,
          disabled: status === 'disabled',
        };

        if (hasChangeGroups(occurrenceToUpdateException)) {
          // Exception still has other change groups: update it
          await updateExceptions(dispatch, [updatedException], pacedTrain.id);
        } else {
          // Exception had only disabled: true and nothing else → delete it entirely
          // TODO_EXCEPTION: remove `!` when using TrainSchedulingException type
          await deleteExceptions(dispatch, [occurrenceToUpdateException.id!]);
        }
        exceptionsToUpdate = updatedException;
      } else {
        if (status === 'enable') {
          throw new Error('Cannot enable an occurrence which was not disabled');
        }

        // TODO_EXCEPTION: remove key when using TrainSchedulingException type
        const key = '';
        // No exception yet: create one with disabled: true
        const exceptionToCreate: PacedTrainException = {
          occurrence_index: occurrence.occurrenceIndex,
          key,
          disabled: true,
        };
        const [createdException] = await createExceptions(
          dispatch,
          [exceptionToCreate],
          pacedTrain.id,
          timetableId
        );
        exceptionsToUpdate = { ...exceptionToCreate, id: createdException.id };
      }

      const updatedExceptions = updatePacedTrainExceptionsList(
        pacedTrain.paced.exceptions,
        exceptionsToUpdate,
        occurrence.id
      );

      upsertWithNewExceptions(updatedExceptions);

      // If we are disabling the selected occurrence, we want to put the selection
      // on the first enabled occurrence chronologically
      if (status === 'disabled' && selectedTrainId === occurrence.id) {
        const firstEnabledOccurrence = occurrences.find(
          (occ) => occ.id !== occurrence.id && !occ.disabled
        );

        dispatch(
          updateSelectedTrain(
            firstEnabledOccurrence ? { id: firstEnabledOccurrence.id, by: 'timetable' } : undefined
          )
        );
        // TODO exceptions : update projected occurrence id in issue https://github.com/OpenRailAssociation/osrd/issues/11476
      }
    },
    [pacedTrain, occurrences, selectedTrainId, timetableId]
  );

  /**
   * Resets an occurrence exceptions.
   * If it is an indexed occurrence exception, it is totally removed.
   * If it is an added exception, every change groups are removed except the start time.
   */
  const resetOccurrenceExceptions = useCallback(
    async (occurrenceId: OccurrenceId) => {
      const exceptionToUpdate = findExceptionWithOccurrenceId(
        pacedTrain.paced.exceptions,
        occurrenceId
      );

      if (!exceptionToUpdate) {
        throw new Error('Cannot reset an occurrence which was not an exception');
      }

      let updatedExceptions: SimulatedException[];

      if (isIndexedOccurrenceId(occurrenceId)) {
        updatedExceptions = pacedTrain.paced.exceptions.filter(
          (exception) => exception.occurrence_index !== exceptionToUpdate.occurrence_index
        );

        // TODO_EXCEPTION: remove `!` when using TrainSchedulingException type
        await deleteExceptions(dispatch, [exceptionToUpdate.id!]);
      } else {
        const updatedException = {
          // TODO_EXCEPTION: remove `!` when using TrainSchedulingException type
          id: exceptionToUpdate.id!,
          // TODO_EXCEPTION: remove `key` when using TrainSchedulingException type
          key: '',
          start_time: exceptionToUpdate.start_time,
        };
        // for an added exception, we want to reset all change groups except the start time
        updatedExceptions = pacedTrain.paced.exceptions.map((exception) =>
          exception.id === exceptionToUpdate.id ? updatedException : exception
        );

        await updateExceptions(dispatch, [updatedException], pacedTrain.id);
      }

      upsertWithNewExceptions(updatedExceptions);
    },
    [pacedTrain]
  );

  const deleteAddedException = useCallback(
    async (occurrenceId: OccurrenceId) => {
      const id = extractExceptionIdFromOccurrenceId(occurrenceId);

      const newExceptions = pacedTrain.paced.exceptions.filter((ex) => ex.id !== id);
      const exceptionToDelete = pacedTrain.paced.exceptions.find((ex) => ex.id === id);

      if (!exceptionToDelete?.id) {
        throw new Error('Cannot delete an exception which was not found');
      }
      await deleteExceptions(dispatch, [exceptionToDelete.id]);

      upsertWithNewExceptions(newExceptions);

      // If the deleted exception was selected, select the first remaining enabled occurrence
      if (selectedTrainId === occurrenceId) {
        const firstEnabledOccurrence = occurrences.find(
          (occ) => occ.id !== occurrenceId && !occ.disabled
        );
        dispatch(
          updateSelectedTrain(
            firstEnabledOccurrence ? { id: firstEnabledOccurrence.id, by: 'timetable' } : undefined
          )
        );
      }
    },
    [pacedTrain.paced.exceptions, occurrences, selectedTrainId]
  );

  return {
    toggleOccurrenceSelection,
    selectOccurrenceForProjection,
    editOccurrence,
    updateOccurrenceStatus,
    resetOccurrenceExceptions,
    deleteAddedException,
  };
};

export default useOccurrenceActions;
