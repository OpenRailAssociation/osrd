import { useState, useCallback, useMemo, useEffect } from 'react';

import { useSelector } from 'react-redux';

import type { Conflict, TrainScheduleResponse } from 'common/api/osrdEditoastApi';
import computeOccurrenceName from 'modules/trainSchedule/helpers/computeOccurrenceName';
import {
  findExceptionWithOccurrenceId,
  isPacedTrain,
} from 'modules/trainSchedule/helpers/pacedTrain';
import { getSelectedTrain } from 'reducers/simulationResults/selectors';
import {
  extractTrainScheduleIdFromOccurrenceId,
  isIndexedOccurrenceId,
  extractOccurrenceIndexFromOccurrenceId,
  isOccurrenceId,
  isTrainScheduleId,
  extractEditoastIdFromTrainScheduleId,
} from 'utils/trainId';

import type { ConflictWithTrainNames } from '../types';
import addTrainNamesToConflicts, {
  filterAndReorderConflict,
  reorderConflictTrains,
  reorderConflictTrainsByScheduleId,
} from '../utils';

const useConflictsFilter = (
  trainSchedules: TrainScheduleResponse[],
  conflicts: Conflict[],
  isConflictsLoading: boolean
) => {
  const { id: selectedTrainId } = useSelector(getSelectedTrain) || {};
  const [showOnlySelectedTrain, setShowOnlySelectedTrain] = useState(false);
  const [enrichedConflicts, setEnrichedConflicts] = useState<ConflictWithTrainNames[]>([]);

  const handleToggleConflictsFilter = useCallback(() => {
    setShowOnlySelectedTrain(!showOnlySelectedTrain);
  }, [showOnlySelectedTrain]);

  const trainScheduleById = useMemo<Map<number, TrainScheduleResponse>>(
    () => new Map(trainSchedules.map((trainSchedule) => [trainSchedule.id, trainSchedule])),
    [trainSchedules]
  );

  const selectedTrainName = useMemo(() => {
    if (!selectedTrainId) return null;

    const id = extractEditoastIdFromTrainScheduleId(
      isOccurrenceId(selectedTrainId)
        ? extractTrainScheduleIdFromOccurrenceId(selectedTrainId)
        : selectedTrainId
    );
    const selectedTrain = trainScheduleById.get(id);

    if (!selectedTrain || !isOccurrenceId(selectedTrainId) || !isPacedTrain(selectedTrain))
      return selectedTrain?.train_name || null;

    // Occurrence with a name change group
    const exception = findExceptionWithOccurrenceId(
      selectedTrain.paced.exceptions,
      selectedTrainId
    );
    if (exception?.train_name?.value) {
      return exception.train_name.value;
    }
    // Occcurrence without a name change group
    if (isIndexedOccurrenceId(selectedTrainId)) {
      const index = extractOccurrenceIndexFromOccurrenceId(selectedTrainId);
      return computeOccurrenceName(selectedTrain.train_name, index);
    }
    // added exception: name is `${pacedTrainName}/+`
    return `${selectedTrain.train_name}/+`;
  }, [selectedTrainId, trainScheduleById]);

  const totalConflictsCount = useMemo(() => conflicts.length, [conflicts]);

  useEffect(() => {
    if (isConflictsLoading) return;
    const sortedByStartTime = [...conflicts].sort(
      (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
    );
    setEnrichedConflicts(addTrainNamesToConflicts(sortedByStartTime, trainSchedules));
  }, [conflicts, isConflictsLoading, trainSchedules]);

  const selectedEnrichedConflicts = useMemo(() => {
    if (!selectedTrainId) return [];
    // When a service (paced train) is selected, filter by the paced train's
    // editoast id so that conflicts of all its occurrences are matched.
    if (isTrainScheduleId(selectedTrainId)) {
      const trainScheduleEditoastId = extractEditoastIdFromTrainScheduleId(selectedTrainId);
      return enrichedConflicts
        .filter((conflict) =>
          conflict.train_ids.some((train) => train.train_schedule_id === trainScheduleEditoastId)
        )
        .map((conflict) => ({
          ...conflict,
          trainsData: reorderConflictTrainsByScheduleId(conflict, trainScheduleEditoastId),
        }));
    }
    if (!selectedTrainName) return [];
    return enrichedConflicts
      .map((conflict) => filterAndReorderConflict(conflict, selectedTrainId, selectedTrainName))
      .filter((conflict) => conflict !== null);
  }, [enrichedConflicts, selectedTrainName, selectedTrainId]);

  const selectedTrainConflictsCount = useMemo(() => {
    if (!selectedTrainId) return 0;
    // For a service: sum of conflicts across all its occurrences. A single conflict
    // that involves several occurrences of the same paced train counts once per
    // occurrence, so the total matches the sum displayed on each occurrence.
    if (isTrainScheduleId(selectedTrainId)) {
      const trainScheduleEditoastId = extractEditoastIdFromTrainScheduleId(selectedTrainId);
      return enrichedConflicts.reduce(
        (sum, conflict) =>
          sum +
          conflict.train_ids.filter((train) => train.train_schedule_id === trainScheduleEditoastId)
            .length,
        0
      );
    }
    return selectedEnrichedConflicts.length;
  }, [enrichedConflicts, selectedEnrichedConflicts, selectedTrainId]);

  const displayedConflicts = useMemo(() => {
    if (!showOnlySelectedTrain || !selectedTrainName) {
      // When the selection is a paced train service, several trainsData entries
      // may match (one per occurrence involved in the conflict): reorder by
      // train_schedule_id so that all matching occurrences are highlighted at
      // the front. Otherwise, reorder by the occurrence/train name.
      if (selectedTrainId && isTrainScheduleId(selectedTrainId)) {
        const trainScheduleEditoastId = extractEditoastIdFromTrainScheduleId(selectedTrainId);
        return enrichedConflicts.map((conflict) => ({
          ...conflict,
          trainsData: reorderConflictTrainsByScheduleId(conflict, trainScheduleEditoastId),
        }));
      }
      return enrichedConflicts.map((conflict) => ({
        ...conflict,
        // Always put selected train first, then sort remaining by name length
        trainsData: reorderConflictTrains(conflict.trainsData, selectedTrainName),
      }));
    }
    return selectedEnrichedConflicts;
  }, [
    enrichedConflicts,
    selectedEnrichedConflicts,
    showOnlySelectedTrain,
    selectedTrainName,
    selectedTrainId,
  ]);

  return {
    showOnlySelectedTrain,
    handleToggleConflictsFilter,
    selectedTrainName,
    totalConflictsCount,
    selectedTrainConflictsCount,
    displayedConflicts,
  };
};

export default useConflictsFilter;
