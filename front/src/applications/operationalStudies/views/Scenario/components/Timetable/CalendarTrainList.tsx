import { useCallback, useMemo, useState } from 'react';

import { useSelector } from 'react-redux';
import { Virtualizer } from 'virtua';

import { useScenarioContext } from 'applications/operationalStudies/hooks/useScenarioContext';
import { useSubCategoryContext } from 'common/SubCategoryContext';
import { isPacedTrainWithPacedWithDetails } from 'modules/timetableItem/helpers/pacedTrain';
import type { PacedTrainWithDetails, TimetableItemWithDetails } from 'modules/timetableItem/types';
import { selectTrainToEdit } from 'reducers/osrdconf/operationalStudiesConf';
import type {
  OccurrenceId,
  TimetableItem,
  TimetableItemId,
  TimetableItemToEditData,
} from 'reducers/osrdconf/types';
import {
  getSelectedTrainId,
  getTrainIdUsedForProjection,
} from 'reducers/simulationResults/selectors';
import { useAppDispatch } from 'store';
import { useDateTimeLocale } from 'utils/date';
import { isPacedTrainWithDetails } from 'utils/trainId';

import PacedTrainItem from './PacedTrain/PacedTrainItem';
import TrainScheduleItem from './TrainScheduleItem';
import { MANAGE_TIMETABLE_ITEM_TYPES } from '../../consts';

type CalendarTrainListProps = {
  setDisplayTimetableItemManagement: (mode: string) => void;
  upsertTimetableItems: (timetableItems: TimetableItem[]) => void;
  setTimetableItemToEditData: (timetableItemToEditData?: TimetableItemToEditData) => void;
  setSelectedTimetableItemIds: React.Dispatch<React.SetStateAction<TimetableItemId[]>>;
  removeAndUnselectTrains: (trainIds: TimetableItemId[]) => void;
  timetableItemToEditData?: TimetableItemToEditData;
  timetableItemsWithDetails: TimetableItemWithDetails[];
  selectedTimetableItemIds: TimetableItemId[];
  projectingOnSimulatedPathException: boolean | undefined;
  isSelectMode: boolean;
};

const formatDepartureDate = (d: Date, locale: Intl.Locale) =>
  d.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

const CalendarTrainList = ({
  setDisplayTimetableItemManagement,
  upsertTimetableItems,
  setTimetableItemToEditData,
  setSelectedTimetableItemIds,
  removeAndUnselectTrains,
  timetableItemToEditData,
  timetableItemsWithDetails,
  selectedTimetableItemIds,
  projectingOnSimulatedPathException,
  isSelectMode,
}: CalendarTrainListProps) => {
  const dateTimeLocale = useDateTimeLocale();

  const { workerStatus } = useScenarioContext();
  const subCategories = useSubCategoryContext();

  const [expandedTimetableItemIds, setExpandedTimetableItemIds] = useState<Set<TimetableItemId>>(
    new Set()
  );

  const selectedTrainId = useSelector(getSelectedTrainId);
  const trainIdUsedForProjection = useSelector(getTrainIdUsedForProjection);
  const dispatch = useAppDispatch();

  const handleSelectTimetableItem = useCallback(
    (id: TimetableItemId) => {
      const currentSelectedTrainIds: TimetableItemId[] = selectedTimetableItemIds;
      const index = currentSelectedTrainIds.indexOf(id);

      if (index === -1) {
        currentSelectedTrainIds.push(id);
      } else {
        currentSelectedTrainIds.splice(index, 1);
      }

      setSelectedTimetableItemIds([...currentSelectedTrainIds]);
    },
    [selectedTimetableItemIds]
  );

  const handleExpandTimetableItem = useCallback((id: TimetableItemId) => {
    setExpandedTimetableItemIds((prevExpandedIds) => {
      const newExpandedIds = new Set(prevExpandedIds);
      if (newExpandedIds.has(id)) {
        newExpandedIds.delete(id);
      } else {
        newExpandedIds.add(id);
      }
      return newExpandedIds;
    });
  }, []);

  const currentDepartureDates = useMemo(
    () =>
      timetableItemsWithDetails.map((train) =>
        formatDepartureDate(train.startTime, dateTimeLocale)
      ),
    [timetableItemsWithDetails, dateTimeLocale]
  );

  const showDepartureDates = useMemo(() => {
    let previousDepartureDate = '';
    return currentDepartureDates.map((date) => {
      const show = date !== previousDepartureDate;
      if (show) previousDepartureDate = date;
      return show;
    });
  }, [currentDepartureDates]);

  const selectTimetableItemToEdit = useCallback(
    (
      itemToEdit: TimetableItemWithDetails,
      originalPacedTrain?: PacedTrainWithDetails,
      occurrenceId?: OccurrenceId
    ) => {
      dispatch(selectTrainToEdit({ item: itemToEdit, isOccurrence: !!occurrenceId }));
      const editData = isPacedTrainWithDetails(itemToEdit)
        ? {
            timetableItemId: itemToEdit.id,
            // param originalPacedTrain is defined only when editing an occurrence
            originalPacedTrain: originalPacedTrain ?? itemToEdit,
            occurrenceId,
          }
        : {
            timetableItemId: itemToEdit.id,
          };
      setTimetableItemToEditData(editData);
      setDisplayTimetableItemManagement(MANAGE_TIMETABLE_ITEM_TYPES.edit);
    },
    []
  );

  return (
    <Virtualizer overscan={15}>
      {timetableItemsWithDetails.map((timetableItem, index) => (
        <div key={`timetable-train-card-${timetableItem.id}`} data-train-id={timetableItem.id}>
          {showDepartureDates[index] && (
            <div className="scenario-timetable-departure-date">{currentDepartureDates[index]}</div>
          )}
          {!isPacedTrainWithPacedWithDetails(timetableItem) ? (
            <TrainScheduleItem
              isInSelection={selectedTimetableItemIds.includes(timetableItem.id)}
              handleSelectTrain={handleSelectTimetableItem}
              train={timetableItem}
              isSelected={workerStatus === 'READY' && selectedTrainId === timetableItem.id}
              isModified={timetableItem.id === timetableItemToEditData?.timetableItemId}
              upsertTrainSchedules={upsertTimetableItems}
              removeTrains={removeAndUnselectTrains}
              selectTrainToEdit={selectTimetableItemToEdit}
              setSelectedTimetableItemIds={setSelectedTimetableItemIds}
              projectionPathIsUsed={
                workerStatus === 'READY' && trainIdUsedForProjection === timetableItem.id
              }
              subCategories={subCategories}
              isSelectMode={isSelectMode}
            />
          ) : (
            <PacedTrainItem
              pacedTrain={timetableItem}
              isInSelection={selectedTimetableItemIds.includes(timetableItem.id)}
              selectPacedTrainToEdit={selectTimetableItemToEdit}
              handleSelectPacedTrain={handleSelectTimetableItem}
              isOccurrencesListOpen={expandedTimetableItemIds.has(timetableItem.id)}
              handleOpenOccurrencesList={handleExpandTimetableItem}
              isOnEdit={timetableItem.id === timetableItemToEditData?.timetableItemId}
              selectedTrainId={selectedTrainId}
              upsertTimetableItems={upsertTimetableItems}
              removePacedTrains={removeAndUnselectTrains}
              setSelectedTimetableItemIds={setSelectedTimetableItemIds}
              infraIsCached={workerStatus === 'READY'}
              subCategories={subCategories}
              projectingOnSimulatedPathException={projectingOnSimulatedPathException}
              isSelectMode={isSelectMode}
            />
          )}
        </div>
      ))}
    </Virtualizer>
  );
};

export default CalendarTrainList;
