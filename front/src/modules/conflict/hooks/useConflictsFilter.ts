import { useState, useCallback, useMemo } from 'react';

import { useSelector } from 'react-redux';

import type { Conflict } from 'common/api/osrdEditoastApi';
import computeOccurrenceName from 'modules/timetableItem/helpers/computeOccurrenceName';
import { findExceptionWithOccurrenceId } from 'modules/timetableItem/helpers/pacedTrain';
import type { TimetableItem, TimetableItemId } from 'reducers/osrdconf/types';
import { getSelectedTrainId } from 'reducers/simulationResults/selectors';
import {
  isTrainScheduleId,
  extractPacedTrainIdFromOccurrenceId,
  isPacedTrainResponseWithPacedTrainId,
  isIndexedOccurrenceId,
  extractOccurrenceIndexFromOccurrenceId,
} from 'utils/trainId';

import addTrainNamesToConflicts, { filterAndReorderConflict } from '../utils';

const useConflictsFilter = (timetableItems: TimetableItem[], conflicts: Conflict[] | undefined) => {
  const selectedTrainId = useSelector(getSelectedTrainId);
  const [showOnlySelectedTrain, setShowOnlySelectedTrain] = useState(false);

  const handleToggleConflictsFilter = useCallback(() => {
    setShowOnlySelectedTrain(!showOnlySelectedTrain);
  }, [showOnlySelectedTrain]);

  const timetableItemById = useMemo<Map<TimetableItemId, TimetableItem>>(
    () => new Map(timetableItems.map((item) => [item.id, item])),
    [timetableItems]
  );

  const selectedTrainName = useMemo(() => {
    if (!selectedTrainId) return null;

    let selectedTrain: TimetableItem | undefined;
    if (isTrainScheduleId(selectedTrainId)) {
      selectedTrain = timetableItemById.get(selectedTrainId);
      return selectedTrain?.train_name || null;
    }

    const pacedTrainId = extractPacedTrainIdFromOccurrenceId(selectedTrainId);
    selectedTrain = timetableItemById.get(pacedTrainId);

    if (!selectedTrain || !isPacedTrainResponseWithPacedTrainId(selectedTrain)) return null;

    // Occurrence with a name change group
    const exception = findExceptionWithOccurrenceId(selectedTrain.exceptions, selectedTrainId);
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
  }, [selectedTrainId, timetableItemById]);

  const totalConflictsCount = useMemo(() => conflicts?.length ?? 0, [conflicts]);

  const enrichedConflicts = useMemo(
    () => (conflicts ? addTrainNamesToConflicts(conflicts, timetableItems) : []),
    [conflicts, timetableItems]
  );

  const selectedEnrichedConflicts = useMemo(() => {
    if (!selectedTrainName || !selectedTrainId) return [];
    return enrichedConflicts
      .map((conflict) => filterAndReorderConflict(conflict, selectedTrainId, selectedTrainName))
      .filter((conflict) => conflict !== null);
  }, [enrichedConflicts, selectedTrainName, selectedTrainId]);

  const selectedTrainConflictsCount = selectedEnrichedConflicts.length;

  const displayedConflicts = useMemo(() => {
    if (!showOnlySelectedTrain || !selectedTrainName) {
      return enrichedConflicts;
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
