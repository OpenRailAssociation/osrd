import { useMemo, useCallback, useState } from 'react';

import cx from 'classnames';
import { useSelector } from 'react-redux';
import { Virtualizer } from 'virtua';

import { useScenarioContext } from 'applications/operationalStudies/hooks/useScenarioContext';
import { MANAGE_TIMETABLE_ITEM_TYPES } from 'applications/operationalStudies/views/Scenario/consts';
import { useSubCategoryContext } from 'common/SubCategoryContext';
import type {
  TimetableItemWithDetails,
  PacedTrainWithDetails,
  TrainScheduleWithDetails,
} from 'modules/timetableItem/types';
import { selectTrainToEdit } from 'reducers/osrdconf/operationalStudiesConf';
import type {
  TimetableItemId,
  TimetableItem,
  OccurrenceId,
  TimetableItemToEditData,
} from 'reducers/osrdconf/types';
import {
  getSelectedTrainId,
  getTrainIdUsedForProjection,
} from 'reducers/simulationResults/selectors';
import { useAppDispatch } from 'store';
import { useDateTimeLocale } from 'utils/date';
import { isPacedTrainWithDetails, isTrainScheduleId } from 'utils/trainId';

import PacedTrainItem from './PacedTrain/PacedTrainItem';
import TimetableToolbar from './TimetableToolbar';
import TrainScheduleItem from './TrainScheduleItem';
import type { TimetableFilters } from './types';

type TimetableProps = {
  setDisplayTimetableItemManagement: (mode: string) => void;
  upsertTimetableItems: (timetableItems: TimetableItem[]) => void;
  setTimetableItemToEditData: (timetableItemToEditData?: TimetableItemToEditData) => void;
  setSelectedTimetableItemIds: (selectedTimetableItemIds: TimetableItemId[]) => void;
  removeAndUnselectTrains: (trainIds: TimetableItemId[]) => void;
  showTrainDetails: boolean;
  filteredTimetableItems: TimetableItemWithDetails[];
  timetableFilters: TimetableFilters;
  timetableItemToEditData?: TimetableItemToEditData;
  timetableItems?: TimetableItem[];
  selectedTimetableItemIds: TimetableItemId[];
  projectingOnSimulatedPathException: boolean | undefined;
};

const formatDepartureDate = (d: Date, locale: Intl.Locale) =>
  d.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

const Timetable = ({
  setDisplayTimetableItemManagement,
  upsertTimetableItems,
  setTimetableItemToEditData,
  setSelectedTimetableItemIds,
  removeAndUnselectTrains,
  showTrainDetails,
  filteredTimetableItems,
  timetableFilters,
  timetableItemToEditData,
  timetableItems = [],
  selectedTimetableItemIds,
  projectingOnSimulatedPathException,
}: TimetableProps) => {
  const dateTimeLocale = useDateTimeLocale();

  const { workerStatus } = useScenarioContext();

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
      filteredTimetableItems.map((train) => formatDepartureDate(train.startTime, dateTimeLocale)),
    [filteredTimetableItems, dateTimeLocale]
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

  const subCategories = useSubCategoryContext();

  return (
    <div className="scenario-timetable">
      <div
        className={cx('scenario-timetable-trains', {
          'with-details': showTrainDetails,
        })}
      >
        <TimetableToolbar
          filteredTimetableItems={filteredTimetableItems}
          timetableFilters={timetableFilters}
          timetableItems={timetableItems}
          isInSelection={selectedTimetableItemIds.length > 0}
        />
        <Virtualizer overscan={15}>
          {filteredTimetableItems.map((timetableItem, index) => (
            <div key={`timetable-train-card-${timetableItem.id}`} data-train-id={timetableItem.id}>
              {showDepartureDates[index] && (
                <div className="scenario-timetable-departure-date">
                  {currentDepartureDates[index]}
                </div>
              )}
              {isTrainScheduleId(timetableItem.id) ? (
                <TrainScheduleItem
                  isInSelection={selectedTimetableItemIds.includes(timetableItem.id)}
                  handleSelectTrain={handleSelectTimetableItem}
                  train={timetableItem as TrainScheduleWithDetails}
                  isSelected={workerStatus === 'READY' && selectedTrainId === timetableItem.id}
                  isModified={timetableItem.id === timetableItemToEditData?.timetableItemId}
                  upsertTrainSchedules={upsertTimetableItems}
                  removeTrains={removeAndUnselectTrains}
                  selectTrainToEdit={selectTimetableItemToEdit}
                  projectionPathIsUsed={
                    workerStatus === 'READY' && trainIdUsedForProjection === timetableItem.id
                  }
                  subCategories={subCategories}
                />
              ) : (
                <PacedTrainItem
                  pacedTrain={timetableItem as PacedTrainWithDetails}
                  isInSelection={selectedTimetableItemIds.includes(timetableItem.id)}
                  selectPacedTrainToEdit={selectTimetableItemToEdit}
                  handleSelectPacedTrain={handleSelectTimetableItem}
                  isOccurrencesListOpen={expandedTimetableItemIds.has(timetableItem.id)}
                  handleOpenOccurrencesList={handleExpandTimetableItem}
                  isOnEdit={timetableItem.id === timetableItemToEditData?.timetableItemId}
                  selectedTrainId={selectedTrainId}
                  upsertTimetableItems={upsertTimetableItems}
                  removePacedTrains={removeAndUnselectTrains}
                  infraIsCached={workerStatus === 'READY'}
                  subCategories={subCategories}
                  projectingOnSimulatedPathException={projectingOnSimulatedPathException}
                />
              )}
            </div>
          ))}
        </Virtualizer>
      </div>
    </div>
  );
};

export default Timetable;
