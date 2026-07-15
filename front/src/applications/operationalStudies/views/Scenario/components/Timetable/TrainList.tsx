import { useCallback, useMemo, useState } from 'react';

import { useSelector } from 'react-redux';
import { Virtualizer } from 'virtua';

import { useScenarioContext } from 'applications/operationalStudies/hooks/useScenarioContext';
import type {
  TrainSchedulesByTrainScheduleSet,
  TrainScheduleSetManager,
} from 'applications/operationalStudies/hooks/useScenarioTrainScheduleSet';
import type { CatalogEntry, TrainScheduleResponse } from 'common/api/osrdEditoastApi';
import { Loader } from 'common/Loaders';
import { useSubCategoryContext } from 'common/SubCategoryContext';
import { isPacedTrainWithDetails } from 'modules/trainSchedule/helpers/pacedTrain';
import type { TrainScheduleWithDetails } from 'modules/trainSchedule/types';
import { selectTrainToEdit } from 'reducers/osrdconf/operationalStudiesConf';
import type { OccurrenceId, TrainScheduleToEditData } from 'reducers/osrdconf/types';
import {
  getSelectedTrain,
  getTrainIdUsedForProjection,
} from 'reducers/simulationResults/selectors';
import { useAppDispatch } from 'store';
import { useDateTimeLocale } from 'utils/date';
import { startTimeToDate } from 'utils/duration';
import { formatEditoastIdToTrainScheduleId } from 'utils/trainId';

import { MANAGE_TRAIN_SCHEDULE_TYPES } from '../../consts';
import PacedTrainItem from './PacedTrain/PacedTrainItem';
import AddNewTrainScheduleSetTab from './TrainScheduleSet/AddNewTrainScheduleSetTab';
import TrainScheduleSetTab from './TrainScheduleSet/TrainScheduleSetTab';
import type { TimetableMode } from './types';
import UniqueTrainItem from './UniqueTrainItem';

type TrainListProps = {
  setDisplayTrainScheduleManagement: (mode: string) => void;
  upsertTrainSchedules: (trainSchedules: TrainScheduleResponse[]) => void;
  setTrainScheduleToEditData: (trainScheduleToEditData?: TrainScheduleToEditData) => void;
  setSelectedTrainScheduleIds: React.Dispatch<React.SetStateAction<number[]>>;
  removeAndUnselectTrains: (trainIds: number[]) => void;
  trainScheduleToEditData?: TrainScheduleToEditData;
  trainSchedulesWithDetails: TrainScheduleWithDetails[];
  selectedTrainScheduleIds: number[];
  projectingOnSimulatedPathException: boolean | undefined;
  isSelectMode: boolean;
  timetableMode: TimetableMode;
  moveTrainSchedule?: (trainScheduleIds: number[]) => void;
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
  setDisplayTrainScheduleManagement,
  upsertTrainSchedules,
  setTrainScheduleToEditData,
  setSelectedTrainScheduleIds,
  removeAndUnselectTrains,
  trainScheduleToEditData,
  trainSchedulesWithDetails,
  selectedTrainScheduleIds,
  projectingOnSimulatedPathException,
  isSelectMode,
  timetableMode,
  moveTrainSchedule,
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

  const [expandedTrainScheduleIds, setExpandedTrainScheduleIds] = useState<Set<number>>(new Set());

  const { id: selectedTrainId } = useSelector(getSelectedTrain) || {};
  const trainIdUsedForProjection = useSelector(getTrainIdUsedForProjection);
  const dispatch = useAppDispatch();

  const handleSelectTrainSchedule = useCallback(
    (id: number) => {
      const currentSelectedTrainIds: number[] = selectedTrainScheduleIds;
      const index = currentSelectedTrainIds.indexOf(id);

      if (index === -1) {
        currentSelectedTrainIds.push(id);
      } else {
        currentSelectedTrainIds.splice(index, 1);
      }

      setSelectedTrainScheduleIds([...currentSelectedTrainIds]);
    },
    [selectedTrainScheduleIds]
  );

  const handleExpandTrainSchedule = useCallback((id: number) => {
    setExpandedTrainScheduleIds((prevExpandedIds) => {
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
        // TODO Hourly timetables: display the actual start time instead of a fictive date
        formatDepartureDate(startTimeToDate(train.startTime), dateTimeLocale)
      ),
    [trainSchedulesWithDetails, dateTimeLocale]
  );

  const showDepartureDates = useMemo(() => {
    let previousDepartureDate = '';
    return currentDepartureDates.map((date) => {
      const show = date !== previousDepartureDate;
      // TODO: fix this lint
      // eslint-disable-next-line react-hooks-js/immutability
      if (show) previousDepartureDate = date;
      return show;
    });
  }, [currentDepartureDates]);

  const selectTrainScheduleToEdit = useCallback(
    (
      trainScheduleToEdit: TrainScheduleWithDetails,
      originalPacedTrain?: TrainScheduleWithDetails,
      occurrenceId?: OccurrenceId
    ) => {
      dispatch(
        selectTrainToEdit({ trainSchedule: trainScheduleToEdit, isOccurrence: !!occurrenceId })
      );
      const editData: TrainScheduleToEditData = {
        trainScheduleId: trainScheduleToEdit.id,
        // param originalPacedTrain is defined only when editing an occurrence
        originalTrainSchedule: originalPacedTrain ?? trainScheduleToEdit,
        occurrenceId,
      };
      setTrainScheduleToEditData(editData);
      setDisplayTrainScheduleManagement(MANAGE_TRAIN_SCHEDULE_TYPES.edit);
    },
    []
  );

  const trainsToItems = useMemo(
    () => (trainSchedules: TrainScheduleWithDetails[]) =>
      trainSchedules.map((trainSchedule, index) => (
        <div key={`timetable-train-card-${trainSchedule.id}`} data-train-id={trainSchedule.id}>
          {timetableMode === 'calendar' && showDepartureDates[index] && (
            <div className="scenario-timetable-departure-date">{currentDepartureDates[index]}</div>
          )}
          {!isPacedTrainWithDetails(trainSchedule) ? (
            <UniqueTrainItem
              isInSelection={selectedTrainScheduleIds.includes(trainSchedule.id)}
              handleSelectTrain={handleSelectTrainSchedule}
              train={trainSchedule}
              isSelected={
                workerStatus === 'READY' &&
                selectedTrainId === formatEditoastIdToTrainScheduleId(trainSchedule.id)
              }
              isModified={trainSchedule.id === trainScheduleToEditData?.trainScheduleId}
              upsertUniqueTrains={upsertTrainSchedules}
              removeTrains={removeAndUnselectTrains}
              selectTrainToEdit={selectTrainScheduleToEdit}
              setSelectedTrainScheduleIds={setSelectedTrainScheduleIds}
              projectionPathIsUsed={
                workerStatus === 'READY' &&
                trainIdUsedForProjection === formatEditoastIdToTrainScheduleId(trainSchedule.id)
              }
              subCategories={subCategories}
              isSelectMode={isSelectMode}
              moveTrainSchedule={() => moveTrainSchedule?.([trainSchedule.id])}
              showMovebutton={timetableMode === 'trainScheduleSet'}
            />
          ) : (
            <PacedTrainItem
              pacedTrain={trainSchedule}
              isInSelection={selectedTrainScheduleIds.includes(trainSchedule.id)}
              selectPacedTrainToEdit={selectTrainScheduleToEdit}
              handleSelectPacedTrain={handleSelectTrainSchedule}
              isOccurrencesListOpen={expandedTrainScheduleIds.has(trainSchedule.id)}
              handleOpenOccurrencesList={handleExpandTrainSchedule}
              isOnEdit={trainSchedule.id === trainScheduleToEditData?.trainScheduleId}
              selectedTrainId={selectedTrainId}
              upsertTrainSchedules={upsertTrainSchedules}
              removePacedTrains={removeAndUnselectTrains}
              setSelectedTrainScheduleIds={setSelectedTrainScheduleIds}
              infraIsCached={workerStatus === 'READY'}
              subCategories={subCategories}
              projectingOnSimulatedPathException={projectingOnSimulatedPathException}
              isSelectMode={isSelectMode}
              moveTrainSchedule={() => moveTrainSchedule?.([trainSchedule.id])}
              showMovebutton={timetableMode === 'trainScheduleSet'}
              timetableId={timetableId}
            />
          )}
        </div>
      )),
    [
      currentDepartureDates,
      showDepartureDates,
      expandedTrainScheduleIds,
      handleExpandTrainSchedule,
      handleSelectTrainSchedule,
      isSelectMode,
      moveTrainSchedule,
      projectingOnSimulatedPathException,
      removeAndUnselectTrains,
      selectTrainScheduleToEdit,
      selectedTrainScheduleIds,
      selectedTrainId,
      setSelectedTrainScheduleIds,
      subCategories,
      trainScheduleToEditData?.trainScheduleId,
      timetableMode,
      trainIdUsedForProjection,
      upsertTrainSchedules,
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
                trains.every((train) => selectedTrainScheduleIds.includes(train.id));
              const isIndeterminate =
                !isSelected && trains.some((train) => selectedTrainScheduleIds.includes(train.id));
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
