import { useCallback } from 'react';

import {
  findExceptionWithOccurrenceId,
  formatPacedTrainWithOccurenceDetails,
} from 'modules/trainschedule/helpers/pacedTrain';
import type { OccurrenceId, TrainId } from 'reducers/osrdconf/types';
import { updateSelectedTrainId } from 'reducers/simulationResults';
import { useAppDispatch } from 'store';

import type { Occurrence, PacedTrainWithDetails } from '../../types';

type OccurrenceActionsParams = {
  pacedTrain: PacedTrainWithDetails;
  selectPacedTrainToEdit: (
    pacedTrainToEdit: PacedTrainWithDetails,
    originalPacedTrain?: PacedTrainWithDetails,
    occurrenceId?: OccurrenceId
  ) => void;
};

const useOccurrenceActions = ({ pacedTrain, selectPacedTrainToEdit }: OccurrenceActionsParams) => {
  const dispatch = useAppDispatch();

  const selectOccurrence = useCallback((occurrenceId: TrainId) => {
    dispatch(updateSelectedTrainId(occurrenceId));
  }, []);

  // We build a new timetable item to edit with the current paced train modified with
  // the occurrence start time and all its eventual exceptions
  const editOccurrence = useCallback(
    async (editedOccurrence: Occurrence) => {
      // TODO refacto this function in issue https://github.com/OpenRailAssociation/osrd/issues/12030
      let updatedPacedtrain: PacedTrainWithDetails = {
        ...pacedTrain,
        name: editedOccurrence.trainName,
        startTime: editedOccurrence.startTime,
      };

      const occurrenceToUpdateException = findExceptionWithOccurrenceId(
        pacedTrain.exceptions,
        editedOccurrence.id
      );

      if (occurrenceToUpdateException) {
        const pacedTrainWithOccurrenceDetails = formatPacedTrainWithOccurenceDetails(
          updatedPacedtrain,
          occurrenceToUpdateException
        );

        let occurrenceRollingStock = pacedTrain.rollingStock;
        if (occurrenceToUpdateException.rolling_stock) {
          occurrenceRollingStock = editedOccurrence.rollingStock;
        }

        updatedPacedtrain = {
          ...pacedTrainWithOccurrenceDetails,
          rollingStock: occurrenceRollingStock,
        };
      }

      selectPacedTrainToEdit(updatedPacedtrain, pacedTrain, editedOccurrence.id);
    },
    [pacedTrain, selectPacedTrainToEdit]
  );

  return {
    selectOccurrence,
    editOccurrence,
  };
};

export default useOccurrenceActions;
