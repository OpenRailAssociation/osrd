import { useState, useCallback, useMemo, useEffect } from 'react';

import { useSelector } from 'react-redux';

import type { Conflict } from 'common/api/osrdEditoastApi';
import computeOccurrenceName from 'modules/timetableItem/helpers/computeOccurrenceName';
import {
  findExceptionWithOccurrenceId,
  isPacedTrain,
} from 'modules/timetableItem/helpers/pacedTrain';
import type { TimetableItem } from 'reducers/osrdconf/types';
import { getSelectedTrainId } from 'reducers/simulationResults/selectors';
import {
  extractPacedTrainIdFromOccurrenceId,
  isIndexedOccurrenceId,
  extractOccurrenceIndexFromOccurrenceId,
  isOccurrenceId,
  extractEditoastIdFromPacedTrainId,
} from 'utils/trainId';

import type { ConflictWithTrainNames } from '../types';
import addTrainNamesToConflicts, {
  filterAndReorderConflict,
  reorderConflictTrains,
} from '../utils';

const useConflictsFilter = (
  timetableItems: TimetableItem[],
  conflicts: Conflict[] | undefined,
  isConflictsLoading: boolean
) => {
  const selectedTrainId = useSelector(getSelectedTrainId);
  const [showOnlySelectedTrain, setShowOnlySelectedTrain] = useState(false);
  const [enrichedConflicts, setEnrichedConflicts] = useState<ConflictWithTrainNames[]>([]);

  const handleToggleConflictsFilter = useCallback(() => {
    setShowOnlySelectedTrain(!showOnlySelectedTrain);
  }, [showOnlySelectedTrain]);

  const timetableItemById = useMemo<Map<number, TimetableItem>>(
    () => new Map(timetableItems.map((item) => [item.id, item])),
    [timetableItems]
  );

  const selectedTrainName = useMemo(() => {
    if (!selectedTrainId) return null;

    const id = extractEditoastIdFromPacedTrainId(
      isOccurrenceId(selectedTrainId)
        ? extractPacedTrainIdFromOccurrenceId(selectedTrainId)
        : selectedTrainId
    );
    const selectedTrain = timetableItemById.get(id);

    if (!selectedTrain || !isOccurrenceId(selectedTrainId) || !isPacedTrain(selectedTrain))
      return selectedTrain?.train_name || null;

    // Occurrence with a name change group
    const exception = findExceptionWithOccurrenceId(
      selectedTrain.paced.exceptions,
      selectedTrainId
    );
    if (exception?.change_groups.train_name?.value) {
      return exception.change_groups.train_name.value;
    }
    // Occcurrence without a name change group
    if (isIndexedOccurrenceId(selectedTrainId)) {
      const index = extractOccurrenceIndexFromOccurrenceId(selectedTrainId);
      return computeOccurrenceName(selectedTrain.train_name, index);
    }
    // added exception: name is `${pacedTrainName}/+`
    return `${selectedTrain.train_name}/+`;
  }, [selectedTrainId, timetableItemById]);

  const totalConflictsCount = useMemo(() => conflicts?.length ?? 0, [conflicts]);

  useEffect(() => {
    if (isConflictsLoading) return;
    const sortedByStartTime = [...conflicts!].sort(
      (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
    );
    setEnrichedConflicts(addTrainNamesToConflicts(sortedByStartTime, timetableItems));
  }, [conflicts, isConflictsLoading, timetableItems]);

  const selectedEnrichedConflicts = useMemo(() => {
    if (!selectedTrainName || !selectedTrainId) return [];
    return enrichedConflicts
      .map((conflict) => filterAndReorderConflict(conflict, selectedTrainId, selectedTrainName))
      .filter((conflict) => conflict !== null);
  }, [enrichedConflicts, selectedTrainName, selectedTrainId]);

  const selectedTrainConflictsCount = selectedEnrichedConflicts.length;

  const displayedConflicts = useMemo(() => {
    if (!showOnlySelectedTrain || !selectedTrainName) {
      return enrichedConflicts.map((conflict) => ({
        ...conflict,
        // Always put selected train first, then sort remaining by name length
        trainsData: reorderConflictTrains(conflict.trainsData, selectedTrainName),
      }));
    }
    return selectedEnrichedConflicts;
  }, [enrichedConflicts, selectedEnrichedConflicts, showOnlySelectedTrain, selectedTrainName]);

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
