import { useMemo, useState, useCallback } from 'react';

import cx from 'classnames';
import dayjs from 'dayjs';
import 'dayjs/locale/fr';
import 'dayjs/locale/de';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import { Virtualizer } from 'virtua';

import { MANAGE_TRAIN_SCHEDULE_TYPES } from 'applications/operationalStudies/consts';
import type { Conflict, InfraState } from 'common/api/osrdEditoastApi';
import ConflictsList from 'modules/conflict/components/ConflictsList';
import { selectTrainToEdit } from 'reducers/osrdconf/operationalStudiesConf';
import type {
  TimetableItemId,
  TimetableItem,
  OccurrenceId,
  TimetableItemToEditData,
} from 'reducers/osrdconf/types';
import { updateSelectedTrainId } from 'reducers/simulationResults';
import {
  getSelectedTrainId,
  getTrainIdUsedForProjection,
} from 'reducers/simulationResults/selectors';
import { useAppDispatch } from 'store';
import {
  formatEditoastIdToTrainScheduleId,
  isPacedTrainWithDetails,
  isTrainScheduleId,
} from 'utils/trainId';

import PacedTrainItem from './PacedTrain/PacedTrainItem';
import TimetableToolbar from './TimetableToolbar';
import TrainScheduleItem from './TrainScheduleItem';
import type {
  PacedTrainWithDetails,
  TimetableItemWithDetails,
  TrainScheduleWithDetails,
} from './types';
import useFilterTimetableItems from './useFilterTimetableItems';

type TimetableProps = {
  setDisplayTrainScheduleManagement: (mode: string) => void;
  infraState: InfraState;
  conflicts?: Conflict[];
  upsertTimetableItems: (timetableItems: TimetableItem[]) => void;
  setTimetableItemToEditData: (timetableItemToEditData?: TimetableItemToEditData) => void;
  removeTimetableItems: (timetableItemsToRemove: TimetableItemId[]) => void;
  timetableItemToEditData?: TimetableItemToEditData;
  timetableItems?: TimetableItem[];
  timetableItemsWithDetails: TimetableItemWithDetails[];
};

const formatDepartureDate = (d: Date, locale: string) =>
  dayjs(d).locale(locale).format('dddd D MMMM YYYY');

const Timetable = ({
  setDisplayTrainScheduleManagement,
  infraState,
  conflicts,
  upsertTimetableItems,
  removeTimetableItems,
  setTimetableItemToEditData,
  timetableItemToEditData,
  timetableItems = [],
  timetableItemsWithDetails,
}: TimetableProps) => {
  const { t, i18n } = useTranslation('operational-studies', { keyPrefix: 'main' });

  const [conflictsListExpanded, setConflictsListExpanded] = useState(false);
  const [selectedTimetableItemIds, setSelectedTimetableItemIds] = useState<TimetableItemId[]>([]);
  const [showTrainDetails, setShowTrainDetails] = useState(false);
  const selectedTrainId = useSelector(getSelectedTrainId);
  const trainIdUsedForProjection = useSelector(getTrainIdUsedForProjection);
  const dispatch = useAppDispatch();

  const toggleShowTrainDetails = () => {
    setShowTrainDetails(!showTrainDetails);
  };

  const removeAndUnselectTrains = useCallback(
    (timetableItemIds: TimetableItemId[]) => {
      removeTimetableItems(timetableItemIds);
      setSelectedTimetableItemIds([]);
    },
    [removeTimetableItems, setSelectedTimetableItemIds]
  );

  const { filteredTimetableItems, ...timetableFilters } =
    useFilterTimetableItems(timetableItemsWithDetails);

  const toggleConflictsListExpanded = () => {
    setConflictsListExpanded(!conflictsListExpanded);
  };

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

  const handleConflictClick = (conflict: Conflict) => {
    if (conflict.train_schedule_ids.length > 0) {
      // TODO Paced train : Adapt this to handle paced trains in conflict issue
      const formattedFirstTrainId = formatEditoastIdToTrainScheduleId(
        conflict.train_schedule_ids[0]
      );
      dispatch(updateSelectedTrainId(formattedFirstTrainId));
    }
  };

  const currentDepartureDates = useMemo(
    () =>
      filteredTimetableItems.map((train) => formatDepartureDate(train.startTime, i18n.language)),
    [filteredTimetableItems, i18n.language]
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
      setDisplayTrainScheduleManagement(MANAGE_TRAIN_SCHEDULE_TYPES.edit);
    },
    []
  );

  return (
    <div className="scenario-timetable">
      <div className="scenario-timetable-addtrains-buttons">
        <button
          type="button"
          data-testid="scenarios-add-train-schedule-button"
          onClick={() => {
            setDisplayTrainScheduleManagement(MANAGE_TRAIN_SCHEDULE_TYPES.add);
          }}
        >
          {t('timetable.addTrainScheduleOrPacedTrain')}
        </button>
        <button
          type="button"
          data-testid="scenarios-import-timetable-item-button"
          onClick={() => setDisplayTrainScheduleManagement(MANAGE_TRAIN_SCHEDULE_TYPES.import)}
        >
          {t('timetable.importTimetableItem')}
        </button>
      </div>
      <div
        className={cx('scenario-timetable-trains', {
          expanded: conflictsListExpanded,
          'with-details': showTrainDetails,
        })}
      >
        <TimetableToolbar
          showTrainDetails={showTrainDetails}
          toggleShowTrainDetails={toggleShowTrainDetails}
          timetableItemsWithDetails={timetableItemsWithDetails}
          filteredTimetableItems={filteredTimetableItems}
          timetableFilters={timetableFilters}
          selectedTimetableItemIds={selectedTimetableItemIds}
          setSelectedTimetableItemIds={setSelectedTimetableItemIds}
          removeTrains={removeAndUnselectTrains}
          timetableItems={timetableItems}
          isInSelection={selectedTimetableItemIds.length > 0}
        />
        <Virtualizer overscan={15}>
          {filteredTimetableItems.map((timetableItem, index) => (
            <div key={`timetable-train-card-${timetableItem.id}`}>
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
                  isSelected={infraState === 'CACHED' && selectedTrainId === timetableItem.id}
                  isModified={timetableItem.id === timetableItemToEditData?.timetableItemId}
                  upsertTrainSchedules={upsertTimetableItems}
                  removeTrains={removeAndUnselectTrains}
                  selectTrainToEdit={selectTimetableItemToEdit}
                  projectionPathIsUsed={
                    infraState === 'CACHED' && trainIdUsedForProjection === timetableItem.id
                  }
                />
              ) : (
                <PacedTrainItem
                  pacedTrain={timetableItem as PacedTrainWithDetails}
                  isInSelection={selectedTimetableItemIds.includes(timetableItem.id)}
                  selectPacedTrainToEdit={selectTimetableItemToEdit}
                  handleSelectPacedTrain={handleSelectTimetableItem}
                  isOnEdit={timetableItem.id === timetableItemToEditData?.timetableItemId}
                  selectedTrainId={selectedTrainId}
                  upsertTimetableItems={upsertTimetableItems}
                  removePacedTrains={removeAndUnselectTrains}
                  isProjectionPathUsed={
                    infraState === 'CACHED' && trainIdUsedForProjection === timetableItem.id
                  }
                />
              )}
            </div>
          ))}
        </Virtualizer>
        <div
          className={cx('bottom-timetables-trains', {
            'empty-list': timetableItemsWithDetails.length === 0,
          })}
        />
      </div>
      {conflicts && (
        <ConflictsList
          conflicts={conflicts}
          expanded={conflictsListExpanded}
          toggleConflictsList={toggleConflictsListExpanded}
          timetableItems={filteredTimetableItems}
          onConflictClick={handleConflictClick}
        />
      )}
    </div>
  );
};

export default Timetable;
