import { useCallback, useState } from 'react';

import cx from 'classnames';
import { useTranslation } from 'react-i18next';

import useScenarioTrainScheduleSet from 'applications/operationalStudies/hooks/useScenarioTrainScheduleSet';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import type { TrainScheduleWithDetails } from 'modules/timetableItem/types';
import { setFailure } from 'reducers/main';
import type { TimetableItem, TrainScheduleToEditData } from 'reducers/osrdconf/types';
import { useAppDispatch } from 'store';
import { castErrorToFailure } from 'utils/error';

import TimetableToolbar from './TimetableToolbar';
import TrainList from './TrainList';
import TrainScheduleMoveDialog from './TrainScheduleSet/TrainScheduleMoveDialog';
import TrainScheduleSetDialog from './TrainScheduleSet/TrainScheduleSetDialog';
import type { TimetableMode } from './types';
import useFilterTrainSchedules from './useFilterTimetableItems';

type TimetableProps = {
  setDisplayTrainScheduleManagement: (mode: string) => void;
  upsertTimetableItems: (timetableItems: TimetableItem[]) => void;
  setTrainScheduleToEditData: (trainScheduleToEditData?: TrainScheduleToEditData) => void;
  setSelectedTrainScheduleIds: React.Dispatch<React.SetStateAction<number[]>>;
  removeAndUnselectTrains: (trainIds: number[]) => void;
  handleDeleteTimetableItems: () => void;
  trainScheduleToEditData?: TrainScheduleToEditData;
  timetableItems?: TimetableItem[];
  trainSchedulesWithDetails: TrainScheduleWithDetails[];
  refreshNge: () => Promise<void>;
  selectedTrainScheduleIds: number[];
  projectingOnSimulatedPathException: boolean | undefined;
};

const Timetable = ({
  setDisplayTrainScheduleManagement,
  upsertTimetableItems,
  setTrainScheduleToEditData,
  setSelectedTrainScheduleIds,
  removeAndUnselectTrains,
  handleDeleteTimetableItems,
  trainScheduleToEditData,
  timetableItems = [],
  trainSchedulesWithDetails,
  refreshNge,
  selectedTrainScheduleIds,
  projectingOnSimulatedPathException,
}: TimetableProps) => {
  const dispatch = useAppDispatch();

  const { t } = useTranslation('operational-studies', { keyPrefix: 'main.timetable' });

  const [showTrainDetails, setShowTrainDetails] = useState(false);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [timetableMode, setTimetableMode] = useState<TimetableMode>('calendar');
  const [expandedTrainScheduleSetIds, setExpandedTrainScheduleSetIds] = useState<Set<number>>(
    new Set()
  );
  const [showTrainScheduleSetDialog, setShowTrainScheduleSetDialog] = useState(false);

  const [updateTrainSchedulesTssId] = osrdEditoastApi.endpoints.patchTrainSchedulesMove.useMutation(
    {}
  );

  const [showTrainScheduleMoveDialog, setShowTrainScheduleMoveDialog] = useState(false);
  const [pacedTrainIdsToMove, setPacedTrainIdsToMove] = useState<number[]>([]);
  const [trainScheduleSetIdSelected, setTrainScheduleSetIdSelected] = useState<number>();

  const { trainSchedulesByTrainScheduleSets, catalogEntries, manageTrainScheduleSet } =
    useScenarioTrainScheduleSet(trainSchedulesWithDetails, timetableItems, upsertTimetableItems);

  const { filteredTrainSchedules, ...timetableFilters } =
    useFilterTrainSchedules(trainSchedulesWithDetails);

  const handleClickTrainScheduleSet = useCallback(
    (id: number) => {
      const newExpandedSet = new Set(expandedTrainScheduleSetIds);
      if (newExpandedSet.has(id)) {
        newExpandedSet.delete(id);
      } else {
        newExpandedSet.add(id);
      }
      setExpandedTrainScheduleSetIds(newExpandedSet);
    },
    [expandedTrainScheduleSetIds]
  );

  const handleSelectTrainScheduleSet = useCallback(
    (trainIds: number[]) => {
      const allSelected = trainIds.every((id) => selectedTrainScheduleIds.includes(id));
      if (allSelected) {
        // Deselect all
        setSelectedTrainScheduleIds((prevSelectedIds) =>
          prevSelectedIds.filter((id) => !trainIds.includes(id))
        );
      } else {
        // Select all
        setSelectedTrainScheduleIds((prevSelectedIds) => [
          ...prevSelectedIds,
          ...trainIds.filter((id) => !prevSelectedIds.includes(id)),
        ]);
      }
    },
    [selectedTrainScheduleIds]
  );

  const openMoveDialog = useCallback((pacedTrainIds: number[]) => {
    if (pacedTrainIds.length === 0) return;

    setPacedTrainIdsToMove(pacedTrainIds);
    setShowTrainScheduleMoveDialog(true);
  }, []);

  const handleSubmitMove = useCallback(
    async (trainScheduleSetId: number) => {
      try {
        await updateTrainSchedulesTssId({
          body: {
            train_schedule_ids: pacedTrainIdsToMove,
            train_schedule_set_id: trainScheduleSetId,
          },
        }).unwrap();

        const trainsToUpsert = timetableItems
          .filter((item) => pacedTrainIdsToMove.includes(item.id))
          .map((item) => ({
            ...item,
            train_schedule_set_id: trainScheduleSetId,
          }));

        upsertTimetableItems(trainsToUpsert);
      } catch (e) {
        dispatch(setFailure(castErrorToFailure(e)));
      } finally {
        setPacedTrainIdsToMove([]);
      }
    },
    [pacedTrainIdsToMove, updateTrainSchedulesTssId, dispatch]
  );

  return (
    <div className="scenario-timetable">
      <div
        className={cx('scenario-timetable-trains', {
          'with-details': showTrainDetails,
        })}
      >
        <TimetableToolbar
          filteredTrainSchedules={filteredTrainSchedules}
          timetableFilters={timetableFilters}
          timetableItems={timetableItems}
          selectedTrainScheduleIds={selectedTrainScheduleIds}
          showTrainDetails={showTrainDetails}
          isSelectMode={isSelectMode}
          setSelectedTrainScheduleIds={setSelectedTrainScheduleIds}
          setShowTrainDetails={setShowTrainDetails}
          setIsSelectMode={setIsSelectMode}
          setDisplayTrainScheduleManagement={setDisplayTrainScheduleManagement}
          refreshNge={refreshNge}
          handleDeleteTimetableItems={handleDeleteTimetableItems}
          handleMoveTimetableItems={() => openMoveDialog(selectedTrainScheduleIds)}
          timetableMode={timetableMode}
          setTimetableMode={setTimetableMode}
          upsertTimetableItems={upsertTimetableItems}
        />
        <TrainList
          setDisplayTrainScheduleManagement={setDisplayTrainScheduleManagement}
          upsertTimetableItems={upsertTimetableItems}
          setTrainScheduleToEditData={setTrainScheduleToEditData}
          setSelectedTrainScheduleIds={setSelectedTrainScheduleIds}
          removeAndUnselectTrains={removeAndUnselectTrains}
          trainScheduleToEditData={trainScheduleToEditData}
          trainSchedulesWithDetails={filteredTrainSchedules}
          selectedTrainScheduleIds={selectedTrainScheduleIds}
          projectingOnSimulatedPathException={projectingOnSimulatedPathException}
          isSelectMode={isSelectMode}
          timetableMode={timetableMode}
          trainSchedulesByTrainScheduleSets={trainSchedulesByTrainScheduleSets}
          handleClickTrainScheduleSet={handleClickTrainScheduleSet}
          handleSelectTrainScheduleSet={handleSelectTrainScheduleSet}
          catalogEntries={catalogEntries}
          moveTimetableItem={(pacedTrainIds) => openMoveDialog(pacedTrainIds)}
          manageTrainScheduleSet={manageTrainScheduleSet}
          expandedTrainScheduleSetIds={expandedTrainScheduleSetIds}
          setShowTrainScheduleSetDialog={setShowTrainScheduleSetDialog}
        />
      </div>
      {showTrainScheduleSetDialog && (
        <TrainScheduleSetDialog
          catalogEntries={catalogEntries}
          onCancel={() => setShowTrainScheduleSetDialog(false)}
          onSubmit={manageTrainScheduleSet.createSet}
          labels={{
            title: t('trainScheduleSets.newLocalTrainScheduleSet'),
            submit: t('trainScheduleSets.addTrainScheduleSet'),
            cancel: t('trainScheduleSets.cancel'),
          }}
        />
      )}

      {showTrainScheduleMoveDialog && trainSchedulesByTrainScheduleSets && (
        <TrainScheduleMoveDialog
          trainScheduleSets={trainSchedulesByTrainScheduleSets.map((tss) => tss.trainScheduleSet)}
          setTrainScheduleSetIdSelected={setTrainScheduleSetIdSelected}
          trainScheduleSetIdSelected={trainScheduleSetIdSelected}
          catalogEntries={catalogEntries.filter((entry) =>
            trainSchedulesByTrainScheduleSets.some(
              (tss) => tss.trainScheduleSet.catalog_entry_id === entry.id
            )
          )}
          labels={{
            title: t('trainScheduleSets.movingToAnotherPackage'),
            submit: t('trainScheduleSets.moveToSelectPackage'),
            cancel: t('trainScheduleSets.cancel'),
          }}
          onCancel={() => {
            setTrainScheduleSetIdSelected(undefined);
            setShowTrainScheduleMoveDialog(false);
          }}
          onSubmit={handleSubmitMove}
        />
      )}
    </div>
  );
};

export default Timetable;
