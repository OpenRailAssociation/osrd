import { useCallback, useMemo, useState } from 'react';

import { useSelector } from 'react-redux';
import { Virtualizer } from 'virtua';

import {
  useItineraryModalContext,
  type TrainScheduleToEditData,
} from 'applications/operationalStudies/hooks/useItineraryModalContext';
import { useScenarioContext } from 'applications/operationalStudies/hooks/useScenarioContext';
import type {
  TrainSchedulesByTrainScheduleSet,
  TrainScheduleSetManager,
} from 'applications/operationalStudies/hooks/useScenarioTrainScheduleSet';
import type { CatalogEntry } from 'common/api/osrdEditoastApi';
import { Loader } from 'common/Loaders';
import { useSubCategoryContext } from 'common/SubCategoryContext';
import { isPacedTrainWithDetails } from 'modules/trainSchedule/helpers/pacedTrain';
import type { TrainScheduleWithDetails } from 'modules/trainSchedule/types';
import type { OccurrenceId } from 'reducers/osrdconf/types';
import {
  getSelectedTrain,
  getTrainIdUsedForProjection,
} from 'reducers/simulationResults/selectors';
import { useAppDispatch } from 'store';
import { useDateTimeLocale } from 'utils/date';
import { Duration } from 'utils/duration';
import { formatEditoastIdToTrainScheduleId } from 'utils/trainId';

import PacedTrainItem from './PacedTrain/PacedTrainItem';
import AddNewTrainScheduleSetTab from './TrainScheduleSet/AddNewTrainScheduleSetTab';
import TrainScheduleSetTab from './TrainScheduleSet/TrainScheduleSetTab';
import type { TimetableMode } from './types';
import UniqueTrainItem from './UniqueTrainItem';

type TrainListProps = {
  setSelectedTrainScheduleIds: React.Dispatch<React.SetStateAction<number[]>>;
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
  setSelectedTrainScheduleIds,
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
  const { trainScheduleToEditData } = useItineraryModalContext();

  const dateTimeLocale = useDateTimeLocale();

  const { workerStatus, timetableId, scenario } = useScenarioContext();
  const isHourlyTimetable = scenario.timetable_type === 'HOURLY';
  const subCategories = useSubCategoryContext();

  const [expandedTrainScheduleIds, setExpandedTrainScheduleIds] = useState<Set<number>>(new Set());

  const { id: selectedTrainId } = useSelector(getSelectedTrain) || {};
  const trainIdUsedForProjection = useSelector(getTrainIdUsedForProjection);
  const dispatch = useAppDispatch();

  const { openItineraryModalToEdit } = useItineraryModalContext();

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
      // Hourly timetables have no calendar date to group trains by: their start time is an
      // offset from the timetable start, not tied to any real day.
      isHourlyTimetable
        ? []
        : trainSchedulesWithDetails.map((train) => {
            if (train.startTime instanceof Duration) {
              throw new Error('A calendar timetable train cannot have a Duration start time');
            }
            return formatDepartureDate(train.startTime, dateTimeLocale);
          }),
    [isHourlyTimetable, trainSchedulesWithDetails, dateTimeLocale]
  );

  const showDepartureDates = useMemo(() => {
    let previousDepartureDate = '';
    return currentDepartureDates.map((date) => {
      const show = date !== previousDepartureDate;
      // TODO: fix this lint
      // eslint-disable-next-line react/immutability
      if (show) previousDepartureDate = date;
      return show;
    });
  }, [currentDepartureDates]);

  const selectTrainScheduleToEdit = useCallback(
    (
      trainScheduleToEdit: TrainScheduleWithDetails,
      parentPacedTrain?: TrainScheduleWithDetails,
      occurrenceId?: OccurrenceId
    ) => {
      const editData: TrainScheduleToEditData = {
        trainSchedule: trainScheduleToEdit,
        // param parentPacedTrain is defined only when editing an occurrence
        parentPacedTrain,
        occurrenceId,
      };
      openItineraryModalToEdit(editData);
    },
    [openItineraryModalToEdit, dispatch]
  );

  const trainsToItems = useMemo(
    () => (trainSchedules: TrainScheduleWithDetails[]) =>
      trainSchedules.map((trainSchedule, index) => (
        <div key={`timetable-train-card-${trainSchedule.id}`} data-train-id={trainSchedule.id}>
          {timetableMode === 'chronological' && showDepartureDates[index] && (
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
              isModified={trainSchedule.id === trainScheduleToEditData?.trainSchedule.id}
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
              isOnEdit={trainSchedule.id === trainScheduleToEditData?.trainSchedule.id}
              selectedTrainId={selectedTrainId}
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
      selectTrainScheduleToEdit,
      selectedTrainScheduleIds,
      selectedTrainId,
      setSelectedTrainScheduleIds,
      subCategories,
      trainScheduleToEditData?.trainSchedule.id,
      timetableMode,
      trainIdUsedForProjection,
      workerStatus,
    ]
  );

  return (
    <Virtualizer>
      {timetableMode === 'chronological' && trainsToItems(trainSchedulesWithDetails)}
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
