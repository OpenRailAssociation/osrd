import { useCallback } from 'react';

import { useSelector } from 'react-redux';
import { v4 as uuidV4 } from 'uuid';

import { useScenarioContext } from 'applications/operationalStudies/hooks/useScenarioContext';
import { updatePacedTrainExceptionsList } from 'applications/operationalStudies/views/Scenario/components/ManageTimetableItem/helpers/buildPacedTrainException';
import { formatPacedTrainWithDetailsToPacedTrainPayload } from 'applications/operationalStudies/views/Scenario/components/ManageTimetableItem/helpers/formatTimetableItemPayload';
import type { PacedTrain } from 'common/api/osrdEditoastApi';
import {
  findExceptionWithOccurrenceId,
  extractOccurrenceDetailsFromPacedTrain,
} from 'modules/timetableItem/helpers/pacedTrain';
import { storePacedTrain } from 'modules/timetableItem/helpers/updateTimetableItemHelpers';
import type {
  Occurrence,
  PacedTrainWithDetails,
  SimulatedException,
} from 'modules/timetableItem/types';
import type { OccurrenceId, TimetableItem, TimetableItemId } from 'reducers/osrdconf/types';
import { updateSelectedTrainId, updateTrainIdUsedForProjection } from 'reducers/simulationResults';
import { getSelectedTrainId } from 'reducers/simulationResults/selectors';
import { useAppDispatch } from 'store';
import { isIndexedOccurrenceId, extractExceptionIdFromOccurrenceId } from 'utils/trainId';

type OccurrenceActionsParams = {
  pacedTrain: PacedTrainWithDetails;
  occurrences: Occurrence[];
  selectPacedTrainToEdit: (
    pacedTrainToEdit: PacedTrainWithDetails,
    originalPacedTrain?: PacedTrainWithDetails,
    occurrenceId?: OccurrenceId
  ) => void;
  upsertTimetableItems: (timetableItems: TimetableItem[]) => void;
  removePacedTrains: (pacedTrainIdsToRemove: TimetableItemId[]) => void;
};

const useOccurrenceActions = ({
  pacedTrain,
  occurrences,
  selectPacedTrainToEdit,
  upsertTimetableItems,
  removePacedTrains,
}: OccurrenceActionsParams) => {
  const dispatch = useAppDispatch();
  const { timetableId } = useScenarioContext();

  const selectedTrainId = useSelector(getSelectedTrainId);

  const selectOccurrence = useCallback((occurrenceId: OccurrenceId) => {
    dispatch(updateSelectedTrainId(occurrenceId));
  }, []);

  const selectOccurrenceForProjection = useCallback((occurrenceId: OccurrenceId) => {
    dispatch(updateTrainIdUsedForProjection(occurrenceId));
  }, []);

  // We build a new timetable item to edit with the current paced train modified with
  // the occurrence start time and all its eventual exceptions
  const editOccurrence = useCallback(
    async (editedOccurrence: Occurrence) => {
      let occurrenceWithDetails: PacedTrainWithDetails = pacedTrain;

      const occurrenceToUpdateException = findExceptionWithOccurrenceId(
        pacedTrain.exceptions,
        editedOccurrence.id
      );

      const rawPacedTrain: Omit<PacedTrain, 'paced'> = {
        ...pacedTrain,
        train_name: editedOccurrence.trainName,
        speed_limit_tag: pacedTrain.speedLimitTag,
        rolling_stock_name: editedOccurrence.rollingStock?.name || '',
        start_time: editedOccurrence.startTime.toISOString(),
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
    (occurrence: Occurrence, status: 'disabled' | 'enable') => {
      const occurrenceToUpdateException = findExceptionWithOccurrenceId(
        pacedTrain.exceptions,
        occurrence.id
      );

      // If we can enable an occurrence, it should be among the exceptions with disabled true
      if (status === 'enable' && !occurrenceToUpdateException) {
        throw new Error('Cannot enable an occurrence which was not disabled');
      }

      const updatedException = occurrenceToUpdateException
        ? {
            ...occurrenceToUpdateException,
            disabled: status === 'disabled' ? true : undefined,
          }
        : {
            key: uuidV4(),
            occurrence_index: occurrence.occurrenceIndex,
            disabled: true,
          };

      const updatedExceptions = updatePacedTrainExceptionsList(
        pacedTrain.exceptions,
        updatedException,
        occurrence.id
      );

      const formattedPacedTrain = formatPacedTrainWithDetailsToPacedTrainPayload({
        ...pacedTrain,
        exceptions: updatedExceptions,
      });

      storePacedTrain(
        pacedTrain.id,
        formattedPacedTrain,
        timetableId,
        dispatch,
        upsertTimetableItems,
        removePacedTrains
      );

      // If we are disabling the selected occurrence, we want to put the selection
      // on the first enabled occurrence chronologically
      if (status === 'disabled' && selectedTrainId === occurrence.id) {
        const firstEnabledOccurrence = occurrences.find(
          (occ) => occ.id !== occurrence.id && !occ.disabled
        );

        dispatch(updateSelectedTrainId(firstEnabledOccurrence?.id));
        // TODO exceptions : update projected occurrence id in issue https://github.com/OpenRailAssociation/osrd/issues/11476
      }
    },
    [pacedTrain, occurrences, selectedTrainId]
  );

  /**
   * Resets an occurrence exceptions.
   * If it is an indexed occurrence exception, it is totally removed.
   * If it is an added exception, every change groups are removed except the start time.
   */
  const resetOccurrenceExceptions = useCallback(
    (occurrenceId: OccurrenceId) => {
      const exceptionToUpdate = findExceptionWithOccurrenceId(pacedTrain.exceptions, occurrenceId);

      if (!exceptionToUpdate) {
        throw new Error('Cannot reset an occurrence which was not an exception');
      }

      let updatedExceptions: SimulatedException[];

      if (isIndexedOccurrenceId(occurrenceId)) {
        updatedExceptions = pacedTrain.exceptions.filter(
          // If it is an indexed occurrence, the corresponding exception will always have an occurrence_index
          (exception) => exception.occurrence_index !== exceptionToUpdate.occurrence_index
        );
      } else {
        // update exceptionToUpdate by removing all its properties except key and start time
        updatedExceptions = pacedTrain.exceptions.map((exception) =>
          exception.key === exceptionToUpdate.key
            ? {
                key: exceptionToUpdate.key,
                start_time: exceptionToUpdate.start_time,
              }
            : exception
        );
      }

      const formattedPacedTrain = formatPacedTrainWithDetailsToPacedTrainPayload({
        ...pacedTrain,
        exceptions: updatedExceptions,
      });

      storePacedTrain(
        pacedTrain.id,
        formattedPacedTrain,
        timetableId,
        dispatch,
        upsertTimetableItems,
        removePacedTrains
      );
    },
    [pacedTrain]
  );

  const deleteAddedException = useCallback(
    async (occurrenceId: OccurrenceId) => {
      const key = extractExceptionIdFromOccurrenceId(occurrenceId);
      const newExceptions = pacedTrain.exceptions.filter((ex) => ex.key !== key);
      const updatedPacedTrainPayload = {
        ...formatPacedTrainWithDetailsToPacedTrainPayload(pacedTrain),
        exceptions: newExceptions,
      };

      storePacedTrain(
        pacedTrain.id,
        updatedPacedTrainPayload,
        timetableId,
        dispatch,
        upsertTimetableItems,
        removePacedTrains
      );
    },
    [pacedTrain.exceptions]
  );

  return {
    selectOccurrence,
    selectOccurrenceForProjection,
    editOccurrence,
    updateOccurrenceStatus,
    resetOccurrenceExceptions,
    deleteAddedException,
  };
};

export default useOccurrenceActions;
