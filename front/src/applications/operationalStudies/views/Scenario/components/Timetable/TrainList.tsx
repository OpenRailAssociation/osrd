import { useCallback, useMemo, useState } from 'react';

import { useSelector } from 'react-redux';
import { Virtualizer } from 'virtua';

import { useScenarioContext } from 'applications/operationalStudies/hooks/useScenarioContext';
import type {
  TimetableItemsByTrainScheduleSet,
  TrainScheduleSetManager,
} from 'applications/operationalStudies/hooks/useScenarioTrainScheduleSet';
import type { CatalogEntry } from 'common/api/osrdEditoastApi';
import { Loader } from 'common/Loaders';
import { useSubCategoryContext } from 'common/SubCategoryContext';
import { isPacedTrainWithDetails } from 'modules/timetableItem/helpers/pacedTrain';
import type { PacedTrainWithDetails, TimetableItemWithDetails } from 'modules/timetableItem/types';
import { selectTrainToEdit } from 'reducers/osrdconf/operationalStudiesConf';
import type { OccurrenceId, TimetableItem, TimetableItemToEditData } from 'reducers/osrdconf/types';
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
  setTimetableItemToEditData: (timetableItemToEditData?: TimetableItemToEditData) => void;
  setSelectedTimetableItemIds: React.Dispatch<React.SetStateAction<number[]>>;
  removeAndUnselectTrains: (trainIds: number[]) => void;
  timetableItemToEditData?: TimetableItemToEditData;
  timetableItemsWithDetails: TimetableItemWithDetails[];
  selectedTimetableItemIds: number[];
  projectingOnSimulatedPathException: boolean | undefined;
  isSelectMode: boolean;
  timetableMode: TimetableMode;
  moveTimetableItem?: (pacedTrainIds: number[]) => void;
  timetableItemsByTrainScheduleSets: TimetableItemsByTrainScheduleSet[] | null;
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
  setTimetableItemToEditData,
  setSelectedTimetableItemIds,
  removeAndUnselectTrains,
  timetableItemToEditData,
  timetableItemsWithDetails,
  selectedTimetableItemIds,
  projectingOnSimulatedPathException,
  isSelectMode,
  timetableMode,
  moveTimetableItem,
  timetableItemsByTrainScheduleSets = null,
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
      timetableItemsWithDetails.map((train) =>
        formatDepartureDate(train.startTime, dateTimeLocale)
      ),
    [timetableItemsWithDetails, dateTimeLocale]
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

  const selectTimetableItemToEdit = useCallback(
    (
      itemToEdit: TimetableItemWithDetails,
      originalPacedTrain?: PacedTrainWithDetails,
      occurrenceId?: OccurrenceId
    ) => {
      dispatch(selectTrainToEdit({ item: itemToEdit, isOccurrence: !!occurrenceId }));
      const editData = {
        timetableItemId: itemToEdit.id,
        // param originalPacedTrain is defined only when editing an occurrence
        originalPacedTrain: originalPacedTrain ?? itemToEdit,
        occurrenceId,
      };
      setTimetableItemToEditData(editData);
      setDisplayTimetableItemManagement(MANAGE_TIMETABLE_ITEM_TYPES.edit);
    },
    []
  );

  const trainsToItems = useMemo(
    () => (timetableItems: PacedTrainWithDetails[]) =>
      timetableItems.map((timetableItem, index) => (
        <div key={`timetable-train-card-${timetableItem.id}`} data-train-id={timetableItem.id}>
          {timetableMode === 'calendar' && showDepartureDates[index] && (
            <div className="scenario-timetable-departure-date">{currentDepartureDates[index]}</div>
          )}
          {!isPacedTrainWithDetails(timetableItem) ? (
            <UniqueTrainItem
              isInSelection={selectedTimetableItemIds.includes(timetableItem.id)}
              handleSelectTrain={handleSelectTimetableItem}
              train={timetableItem}
              isSelected={
                workerStatus === 'READY' &&
                selectedTrainId === formatEditoastIdToPacedTrainId(timetableItem.id)
              }
              isModified={timetableItem.id === timetableItemToEditData?.timetableItemId}
              upsertUniqueTrains={upsertTimetableItems}
              removeTrains={removeAndUnselectTrains}
              selectTrainToEdit={selectTimetableItemToEdit}
              setSelectedTimetableItemIds={setSelectedTimetableItemIds}
              projectionPathIsUsed={
                workerStatus === 'READY' &&
                trainIdUsedForProjection === formatEditoastIdToPacedTrainId(timetableItem.id)
              }
              subCategories={subCategories}
              isSelectMode={isSelectMode}
              moveTimetableItem={() => moveTimetableItem?.([timetableItem.id])}
              showMovebutton={timetableMode === 'trainScheduleSet'}
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
              moveTimetableItem={() => moveTimetableItem?.([timetableItem.id])}
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
      selectTimetableItemToEdit,
      selectedTimetableItemIds,
      selectedTrainId,
      setSelectedTimetableItemIds,
      subCategories,
      timetableItemToEditData?.timetableItemId,
      timetableMode,
      trainIdUsedForProjection,
      upsertTimetableItems,
      workerStatus,
    ]
  );

  return (
    <Virtualizer>
      {timetableMode === 'calendar' && trainsToItems(timetableItemsWithDetails)}
      {timetableMode === 'trainScheduleSet' &&
        (timetableItemsByTrainScheduleSets ? (
          timetableItemsByTrainScheduleSets
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
