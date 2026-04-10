import { useCallback, useMemo, useState } from 'react';

import { useSelector } from 'react-redux';
import { Virtualizer } from 'virtua';

import { useScenarioContext } from 'applications/operationalStudies/hooks/useScenarioContext';
import type {
  TrainSchedulesByTrainScheduleSet,
  TrainScheduleSetManager,
} from 'applications/operationalStudies/hooks/useScenarioTrainScheduleSet';
import type { CatalogEntry } from 'common/api/osrdEditoastApi';
import { Loader } from 'common/Loaders';
import { useSubCategoryContext } from 'common/SubCategoryContext';
import { isPacedTrainWithDetails } from 'modules/timetableItem/helpers/pacedTrain';
import type { PacedTrainWithDetails, TrainScheduleWithDetails } from 'modules/timetableItem/types';
import { selectTrainToEdit } from 'reducers/osrdconf/operationalStudiesConf';
import type { OccurrenceId, TimetableItem, TrainScheduleToEditData } from 'reducers/osrdconf/types';
import {
  getSelectedTrainId,
  getTrainIdUsedForProjection,
} from 'reducers/simulationResults/selectors';
import { useAppDispatch } from 'store';
import { useDateTimeLocale } from 'utils/date';
import { formatEditoastIdToPacedTrainId } from 'utils/trainId';

import { MANAGE_TIMETABLE_ITEM_TYPES } from '../../consts';
import PacedTrainItem from './PacedTrain/PacedTrainItem';
import AddNewTrainScheduleSetTab from './TrainScheduleSet/AddNewTrainScheduleSetTab';
import TrainScheduleSetTab from './TrainScheduleSet/TrainScheduleSetTab';
import type { TimetableMode } from './types';
import UniqueTrainItem from './UniqueTrainItem';

type TrainListProps = {
  setDisplayTimetableItemManagement: (mode: string) => void;
  upsertTimetableItems: (timetableItems: TimetableItem[]) => void;
  setTrainScheduleToEditData: (trainScheduleToEditData?: TrainScheduleToEditData) => void;
  setSelectedTimetableItemIds: React.Dispatch<React.SetStateAction<number[]>>;
  removeAndUnselectTrains: (trainIds: number[]) => void;
  trainScheduleToEditData?: TrainScheduleToEditData;
  trainSchedulesWithDetails: TrainScheduleWithDetails[];
  selectedTimetableItemIds: number[];
  projectingOnSimulatedPathException: boolean | undefined;
  isSelectMode: boolean;
  timetableMode: TimetableMode;
  moveTimetableItem?: (pacedTrainIds: number[]) => void;
  trainSchedulesByTrainScheduleSets: TrainSchedulesByTrainScheduleSet[] | null;
  handleClickTrainScheduleSet: (id: number) => void;
  handleSelectTrainScheduleSet: (trainIds: number[]) => void;
  catalogEntries: CatalogEntry[];
  manageTrainScheduleSet: TrainScheduleSetManager;
  expandedTrainScheduleSetIds: Set<number>;
  setShowTrainScheduleSetDialog: (value: boolean) => void;
};

const formatDepartureDate = (d: Date, locale: Intl.Locale) =>
  d.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

const TrainList = ({
  setDisplayTimetableItemManagement,
  upsertTimetableItems,
  setTrainScheduleToEditData,
  setSelectedTimetableItemIds,
  removeAndUnselectTrains,
  trainScheduleToEditData,
  trainSchedulesWithDetails,
  selectedTimetableItemIds,
  projectingOnSimulatedPathException,
  isSelectMode,
  timetableMode,
  moveTimetableItem,
  trainSchedulesByTrainScheduleSets = null,
  handleClickTrainScheduleSet,
  handleSelectTrainScheduleSet,
  catalogEntries,
  manageTrainScheduleSet,
  expandedTrainScheduleSetIds,
  setShowTrainScheduleSetDialog,
}: TrainListProps) => {
  const dateTimeLocale = useDateTimeLocale();

  const { workerStatus, timetableId } = useScenarioContext();
  const subCategories = useSubCategoryContext();

  const [expandedTimetableItemIds, setExpandedTimetableItemIds] = useState<Set<number>>(new Set());

  const selectedTrainId = useSelector(getSelectedTrainId);
  const trainIdUsedForProjection = useSelector(getTrainIdUsedForProjection);
  const dispatch = useAppDispatch();

  const handleSelectTimetableItem = useCallback(
    (id: number) => {
      const currentSelectedTrainIds: number[] = selectedTimetableItemIds;
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

  const handleExpandTimetableItem = useCallback((id: number) => {
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
      trainSchedulesWithDetails.map((train) =>
        formatDepartureDate(train.startTime, dateTimeLocale)
      ),
    [trainSchedulesWithDetails, dateTimeLocale]
  );

  const showDepartureDates = useMemo(() => {
    let previousDepartureDate = '';
    return currentDepartureDates.map((date) => {
      const show = date !== previousDepartureDate;
      // TODO: fix this lint
      // eslint-disable-next-line react-hooks/immutability
      if (show) previousDepartureDate = date;
      return show;
    });
  }, [currentDepartureDates]);

  const selectTrainScheduleToEdit = useCallback(
    (
      trainScheduleToEdit: TrainScheduleWithDetails,
      originalPacedTrain?: PacedTrainWithDetails,
      occurrenceId?: OccurrenceId
    ) => {
      dispatch(
        selectTrainToEdit({ trainSchedule: trainScheduleToEdit, isOccurrence: !!occurrenceId })
      );
      const editData: TrainScheduleToEditData = {
        trainScheduleId: trainScheduleToEdit.id,
        // param originalPacedTrain is defined only when editing an occurrence
        originalPacedTrain: originalPacedTrain ?? trainScheduleToEdit,
        occurrenceId,
      };
      setTrainScheduleToEditData(editData);
      setDisplayTimetableItemManagement(MANAGE_TIMETABLE_ITEM_TYPES.edit);
    },
    []
  );

  const trainsToItems = useMemo(
    () => (trainSchedules: PacedTrainWithDetails[]) =>
      trainSchedules.map((trainSchedule, index) => (
        <div key={`timetable-train-card-${trainSchedule.id}`} data-train-id={trainSchedule.id}>
          {timetableMode === 'calendar' && showDepartureDates[index] && (
            <div className="scenario-timetable-departure-date">{currentDepartureDates[index]}</div>
          )}
          {!isPacedTrainWithDetails(trainSchedule) ? (
            <UniqueTrainItem
              isInSelection={selectedTimetableItemIds.includes(trainSchedule.id)}
              handleSelectTrain={handleSelectTimetableItem}
              train={trainSchedule}
              isSelected={
                workerStatus === 'READY' &&
                selectedTrainId === formatEditoastIdToPacedTrainId(trainSchedule.id)
              }
              isModified={trainSchedule.id === trainScheduleToEditData?.trainScheduleId}
              upsertUniqueTrains={upsertTimetableItems}
              removeTrains={removeAndUnselectTrains}
              selectTrainToEdit={selectTrainScheduleToEdit}
              setSelectedTimetableItemIds={setSelectedTimetableItemIds}
              projectionPathIsUsed={
                workerStatus === 'READY' &&
                trainIdUsedForProjection === formatEditoastIdToPacedTrainId(trainSchedule.id)
              }
              subCategories={subCategories}
              isSelectMode={isSelectMode}
              moveTimetableItem={() => moveTimetableItem?.([trainSchedule.id])}
              showMovebutton={timetableMode === 'trainScheduleSet'}
            />
          ) : (
            <PacedTrainItem
              pacedTrain={trainSchedule}
              isInSelection={selectedTimetableItemIds.includes(trainSchedule.id)}
              selectPacedTrainToEdit={selectTrainScheduleToEdit}
              handleSelectPacedTrain={handleSelectTimetableItem}
              isOccurrencesListOpen={expandedTimetableItemIds.has(trainSchedule.id)}
              handleOpenOccurrencesList={handleExpandTimetableItem}
              isOnEdit={trainSchedule.id === trainScheduleToEditData?.trainScheduleId}
              selectedTrainId={selectedTrainId}
              upsertTimetableItems={upsertTimetableItems}
              removePacedTrains={removeAndUnselectTrains}
              setSelectedTimetableItemIds={setSelectedTimetableItemIds}
              infraIsCached={workerStatus === 'READY'}
              subCategories={subCategories}
              projectingOnSimulatedPathException={projectingOnSimulatedPathException}
              isSelectMode={isSelectMode}
              moveTimetableItem={() => moveTimetableItem?.([trainSchedule.id])}
              showMovebutton={timetableMode === 'trainScheduleSet'}
              timetableId={timetableId}
            />
          )}
        </div>
      )),
    [
      currentDepartureDates,
      showDepartureDates,
      expandedTimetableItemIds,
      handleExpandTimetableItem,
      handleSelectTimetableItem,
      isSelectMode,
      moveTimetableItem,
      projectingOnSimulatedPathException,
      removeAndUnselectTrains,
      selectTrainScheduleToEdit,
      selectedTimetableItemIds,
      selectedTrainId,
      setSelectedTimetableItemIds,
      subCategories,
      trainScheduleToEditData?.trainScheduleId,
      timetableMode,
      trainIdUsedForProjection,
      upsertTimetableItems,
      workerStatus,
    ]
  );

  return (
    <Virtualizer>
      {timetableMode === 'calendar' && trainsToItems(trainSchedulesWithDetails)}
      {timetableMode === 'trainScheduleSet' &&
        (trainSchedulesByTrainScheduleSets ? (
          trainSchedulesByTrainScheduleSets
            .flatMap(({ trainScheduleSet, catalog, trains }) => {
              const trainScheduleSetTrainsIds = trains.map((train) => train.id);
              const isSelected =
                trains.length > 0 &&
                trains.every((train) => selectedTimetableItemIds.includes(train.id));
              const isIndeterminate =
                !isSelected && trains.some((train) => selectedTimetableItemIds.includes(train.id));
              const isCheckboxDisabled = trains.length === 0;
              const isTrainListOpen = expandedTrainScheduleSetIds.has(trainScheduleSet.id);

              const tab = (
                <TrainScheduleSetTab
                  key={trainScheduleSet.id}
                  trainScheduleSet={trainScheduleSet}
                  catalogName={catalog?.name}
                  handleClickTrainScheduleSet={handleClickTrainScheduleSet}
                  handleSelectTrainScheduleSet={() =>
                    handleSelectTrainScheduleSet(trainScheduleSetTrainsIds)
                  }
                  isSelectMode={isSelectMode}
                  isSelected={isSelected}
                  isIndeterminate={isIndeterminate}
                  isCheckboxDisabled={isCheckboxDisabled}
                  isTrainListOpen={isTrainListOpen}
                  catalogEntries={catalogEntries}
                  manageTrainScheduleSet={manageTrainScheduleSet}
                  trains={trains}
                />
              );

              return isTrainListOpen ? [tab, ...trainsToItems(trains)] : [tab];
            })
            .concat([
              <AddNewTrainScheduleSetTab
                key="add-new-train-schedule"
                onClick={() => setShowTrainScheduleSetDialog(true)}
              />,
            ])
        ) : (
          <Loader className="scenario-timetable-trainschedule-loader" />
        ))}
    </Virtualizer>
  );
};

export default TrainList;
