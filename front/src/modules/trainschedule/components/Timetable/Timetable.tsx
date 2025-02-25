import { useMemo, useState, useCallback, useEffect } from 'react';

import cx from 'classnames';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import { Virtualizer } from 'virtua';

import { MANAGE_TRAIN_SCHEDULE_TYPES } from 'applications/operationalStudies/consts';
import type { Conflict, InfraState } from 'common/api/osrdEditoastApi';
import i18n from 'i18n';
import ConflictsList from 'modules/conflict/components/ConflictsList';
import { selectTrainToEdit } from 'reducers/osrdconf/operationalStudiesConf';
import type { TimetableItemId, TrainScheduleResultWithTrainId } from 'reducers/osrdconf/types';
import { updateSelectedTrainId } from 'reducers/simulationResults';
import {
  getSelectedTrainId,
  getTrainIdUsedForProjection,
} from 'reducers/simulationResults/selectors';
import { getShowPacedTrains } from 'reducers/user/userSelectors';
import { useAppDispatch } from 'store';
import { Duration } from 'utils/duration';
import {
  formatEditoastTrainIdToTrainScheduleId,
  formatEditoastTrainIdToPacedTrainId,
  isTrainSchedule,
} from 'utils/trainId';

import PacedTrainItem from './PacedTrain/PacedTrainItem';
import TimetableToolbar from './TimetableToolbar';
import TrainScheduleItem from './TrainScheduleItem';
import type { PacedTrainWithResult, TimetableItemResult, TrainScheduleWithDetails } from './types';
import useFilterTimetableItems from './useFilterTimetableItems';

type TimetableProps = {
  setDisplayTrainScheduleManagement: (mode: string) => void;
  infraState: InfraState;
  conflicts?: Conflict[];
  upsertTrainSchedules: (trainSchedules: TrainScheduleResultWithTrainId[]) => void;
  setItemIdToEdit: (trainId?: TimetableItemId) => void;
  removeTrains: (trainIds: TimetableItemId[]) => void;
  itemIdToEdit?: TimetableItemId;
  trainSchedules?: TrainScheduleResultWithTrainId[];
  trainSchedulesWithDetails: TrainScheduleWithDetails[];
  dtoImport: () => void;
};

const formatDepartureDate = (d: Date) => dayjs(d).locale(i18n.language).format('dddd D MMMM YYYY');

const Timetable = ({
  setDisplayTrainScheduleManagement,
  infraState,
  conflicts,
  upsertTrainSchedules,
  removeTrains,
  setItemIdToEdit,
  itemIdToEdit,
  trainSchedules = [],
  trainSchedulesWithDetails,
  dtoImport,
}: TimetableProps) => {
  const { t } = useTranslation(['operationalStudies/scenario', 'common/itemTypes']);
  const showPacedTrains = useSelector(getShowPacedTrains);

  const [conflictsListExpanded, setConflictsListExpanded] = useState(false);
  const [selectedTimetableItemIds, setSelectedTimetableItemIds] = useState<TimetableItemId[]>([]);
  const [showTrainDetails, setShowTrainDetails] = useState(false);
  const [timetableItems, setTimetableItems] = useState<TimetableItemResult[]>([]);
  const selectedTrainId = useSelector(getSelectedTrainId);
  const trainIdUsedForProjection = useSelector(getTrainIdUsedForProjection);
  const dispatch = useAppDispatch();

  const toggleShowTrainDetails = () => {
    setShowTrainDetails(!showTrainDetails);
  };

  const removeAndUnselectTrains = useCallback((trainIds: TimetableItemId[]) => {
    removeTrains(trainIds);
    setSelectedTimetableItemIds([]);
    dtoImport();
  }, []);

  const { filteredTimetableItems, ...timetableFilters } = useFilterTimetableItems(timetableItems);

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
      // TODO Paced train : Adapt this to handle paced trains in issue https://github.com/OpenRailAssociation/osrd/issues/10615
      const formattedFirstTrainId = formatEditoastTrainIdToTrainScheduleId(
        conflict.train_schedule_ids[0]
      );
      dispatch(updateSelectedTrainId(formattedFirstTrainId));
    }
  };

  const currentDepartureDates = useMemo(
    () => filteredTimetableItems.map((train) => formatDepartureDate(train.startTime)),
    [filteredTimetableItems]
  );

  const showDepartureDates = useMemo(() => {
    let previousDepartureDate = '';
    return currentDepartureDates.map((date) => {
      const show = date !== previousDepartureDate;
      if (show) previousDepartureDate = date;
      return show;
    });
  }, [currentDepartureDates]);

  const selectTimetableItemToEdit = useCallback((itemToEdit: TimetableItemResult) => {
    dispatch(selectTrainToEdit(itemToEdit));
    // TODO Paced train : Adapt this to handle paced trains in issue https://github.com/OpenRailAssociation/osrd/issues/10615
    setItemIdToEdit(itemToEdit.id);
    setDisplayTrainScheduleManagement(MANAGE_TRAIN_SCHEDULE_TYPES.edit);
  }, []);

  // TODO PACED TRAIN : Remove this after adapting the code to handle paced trains in issue
  useEffect(() => {
    setTimetableItems(
      showPacedTrains && trainSchedulesWithDetails.length > 0
        ? [
            ...trainSchedulesWithDetails,
            {
              ...trainSchedulesWithDetails[0],
              id: formatEditoastTrainIdToPacedTrainId(12345),
              paced: {
                duration: Duration.parse('PT2H'),
                step: Duration.parse('PT30M'),
              },
            },
          ]
        : trainSchedulesWithDetails
    );
  }, [showPacedTrains, trainSchedulesWithDetails]);

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
          data-testid="scenarios-import-train-schedule-button"
          onClick={() => setDisplayTrainScheduleManagement(MANAGE_TRAIN_SCHEDULE_TYPES.import)}
        >
          {t('timetable.importTrainSchedule')}
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
          timetableItems={timetableItems}
          filteredTimetableItems={filteredTimetableItems}
          timetableFilters={timetableFilters}
          selectedTimetableItemIds={selectedTimetableItemIds}
          setSelectedTimetableItemIds={setSelectedTimetableItemIds}
          removeTrains={removeAndUnselectTrains}
          trainSchedules={trainSchedules}
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
              {/* TODO Paced train : Adapt this to handle paced trains in issue
            https://github.com/OpenRailAssociation/osrd/issues/10615 */}
              {isTrainSchedule(timetableItem.id) ? (
                <TrainScheduleItem
                  isInSelection={selectedTimetableItemIds.includes(timetableItem.id)}
                  handleSelectTrain={handleSelectTimetableItem}
                  train={timetableItem as TrainScheduleWithDetails}
                  isSelected={infraState === 'CACHED' && selectedTrainId === timetableItem.id}
                  isModified={timetableItem.id === itemIdToEdit}
                  upsertTrainSchedules={upsertTrainSchedules}
                  removeTrains={removeAndUnselectTrains}
                  selectTrainToEdit={selectTimetableItemToEdit}
                  projectionPathIsUsed={
                    infraState === 'CACHED' && trainIdUsedForProjection === timetableItem.id
                  }
                  dtoImport={dtoImport}
                />
              ) : (
                <PacedTrainItem
                  pacedTrain={timetableItem as PacedTrainWithResult}
                  isInSelection={selectedTimetableItemIds.includes(timetableItem.id)}
                  selectPacedTrainToEdit={selectTimetableItemToEdit}
                  handleSelectPacedTrain={handleSelectTimetableItem}
                  isOnEdit={timetableItem.id === itemIdToEdit}
                  isProjectionPathUsed={false}
                />
              )}
            </div>
          ))}
        </Virtualizer>
        <div
          className={cx('bottom-timetables-trains', {
            'empty-list': trainSchedulesWithDetails.length === 0,
          })}
        />
      </div>
      {conflicts && (
        <ConflictsList
          conflicts={conflicts}
          expanded={conflictsListExpanded}
          toggleConflictsList={toggleConflictsListExpanded}
          // TODO PACED TRAIN : Adapt this props to handle paced trains in issue
          trainSchedulesDetails={
            filteredTimetableItems.filter((timetableItem) =>
              isTrainSchedule(timetableItem.id)
            ) as TrainScheduleWithDetails[]
          }
          onConflictClick={handleConflictClick}
        />
      )}
    </div>
  );
};

export default Timetable;
