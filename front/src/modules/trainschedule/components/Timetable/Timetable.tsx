import { useMemo, useState, useCallback } from 'react';

import cx from 'classnames';
import dayjs from 'dayjs';
import 'dayjs/locale/fr';
import 'dayjs/locale/de';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import { Virtualizer } from 'virtua';

import { MANAGE_TRAIN_SCHEDULE_TYPES } from 'applications/operationalStudies/consts';
import type { InfraState } from 'common/api/osrdEditoastApi';
import { selectTrainToEdit } from 'reducers/osrdconf/operationalStudiesConf';
import type { TimetableItemId, TimetableItem } from 'reducers/osrdconf/types';
import {
  getSelectedTrainId,
  getTrainIdUsedForProjection,
} from 'reducers/simulationResults/selectors';
import { useAppDispatch } from 'store';
import { isTrainScheduleId } from 'utils/trainId';

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
  upsertTimetableItems: (timetableItems: TimetableItem[]) => void;
  setItemIdToEdit: (trainId?: TimetableItemId) => void;
  removeTimetableItems: (timetableItemsToRemove: TimetableItemId[]) => void;
  itemIdToEdit?: TimetableItemId;
  timetableItems?: TimetableItem[];
  timetableItemsWithDetails: TimetableItemWithDetails[];
};

const formatDepartureDate = (d: Date, locale: string) =>
  dayjs(d).locale(locale).format('dddd D MMMM YYYY');

const Timetable = ({
  setDisplayTrainScheduleManagement,
  infraState,
  upsertTimetableItems,
  removeTimetableItems,
  setItemIdToEdit,
  itemIdToEdit,
  timetableItems = [],
  timetableItemsWithDetails,
}: TimetableProps) => {
  const { t, i18n } = useTranslation('operational-studies', { keyPrefix: 'main' });

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

  const selectTimetableItemToEdit = useCallback((itemToEdit: TimetableItemWithDetails) => {
    dispatch(selectTrainToEdit(itemToEdit));
    setItemIdToEdit(itemToEdit.id);
    setDisplayTrainScheduleManagement(MANAGE_TRAIN_SCHEDULE_TYPES.edit);
  }, []);

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
                  isModified={timetableItem.id === itemIdToEdit}
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
                  isOnEdit={timetableItem.id === itemIdToEdit}
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
    </div>
  );
};

export default Timetable;
