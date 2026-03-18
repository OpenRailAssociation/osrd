import { useCallback, useState } from 'react';

import cx from 'classnames';
import { useTranslation } from 'react-i18next';

import useScenarioTrainScheduleSet from 'applications/operationalStudies/hooks/useScenarioTrainScheduleSet';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import type { TimetableItemWithDetails } from 'modules/timetableItem/types';
import { setFailure } from 'reducers/main';
import type {
  TimetableItemId,
  TimetableItem,
  TimetableItemToEditData,
  PacedTrainId,
} from 'reducers/osrdconf/types';
import { useAppDispatch } from 'store';
import { castErrorToFailure } from 'utils/error';
import { extractEditoastIdFromPacedTrainId } from 'utils/trainId';

import TimetableToolbar from './TimetableToolbar';
import TrainList from './TrainList';
import TrainScheduleMoveDialog from './TrainScheduleSet/TrainScheduleMoveDialog';
import TrainScheduleSetDialog from './TrainScheduleSet/TrainScheduleSetDialog';
import type { TimetableMode } from './types';
import useFilterTimetableItems from './useFilterTimetableItems';

type TimetableProps = {
  setDisplayTimetableItemManagement: (mode: string) => void;
  upsertTimetableItems: (timetableItems: TimetableItem[]) => void;
  setTimetableItemToEditData: (timetableItemToEditData?: TimetableItemToEditData) => void;
  setSelectedTimetableItemIds: React.Dispatch<React.SetStateAction<TimetableItemId[]>>;
  removeAndUnselectTrains: (trainIds: TimetableItemId[]) => void;
  handleDeleteTimetableItems: () => void;
  timetableItemToEditData?: TimetableItemToEditData;
  timetableItems?: TimetableItem[];
  timetableItemsWithDetails: TimetableItemWithDetails[];
  refreshNge: () => Promise<void>;
  selectedTimetableItemIds: TimetableItemId[];
  projectingOnSimulatedPathException: boolean | undefined;
};

const Timetable = ({
  setDisplayTimetableItemManagement,
  upsertTimetableItems,
  setTimetableItemToEditData,
  setSelectedTimetableItemIds,
  removeAndUnselectTrains,
  handleDeleteTimetableItems,
  timetableItemToEditData,
  timetableItems = [],
  timetableItemsWithDetails,
  refreshNge,
  selectedTimetableItemIds,
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
  const [pacedTrainIdsToMove, setPacedTrainIdsToMove] = useState<PacedTrainId[]>([]);
  const [trainScheduleSetIdSelected, setTrainScheduleSetIdSelected] = useState<number>();

  const { timetableItemsByTrainScheduleSets, catalogEntries, manageTrainScheduleSet } =
    useScenarioTrainScheduleSet(timetableItemsWithDetails, timetableItems, upsertTimetableItems);

  const { filteredTimetableItems, ...timetableFilters } =
    useFilterTimetableItems(timetableItemsWithDetails);

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
    (trainIds: TimetableItemId[]) => {
      const allSelected = trainIds.every((id) => selectedTimetableItemIds.includes(id));
      if (allSelected) {
        // Deselect all
        setSelectedTimetableItemIds((prevSelectedIds) =>
          prevSelectedIds.filter((id) => !trainIds.includes(id))
        );
      } else {
        // Select all
        setSelectedTimetableItemIds((prevSelectedIds) => [
          ...prevSelectedIds,
          ...trainIds.filter((id) => !prevSelectedIds.includes(id)),
        ]);
      }
    },
    [selectedTimetableItemIds]
  );

  const openMoveDialog = useCallback((pacedTrainIds: PacedTrainId[]) => {
    if (pacedTrainIds.length === 0) return;

    setPacedTrainIdsToMove(pacedTrainIds);
    setShowTrainScheduleMoveDialog(true);
  }, []);

  const handleSubmitMove = useCallback(
    async (trainScheduleSetId: number) => {
      const formattedPacedTrainIds = pacedTrainIdsToMove.map(extractEditoastIdFromPacedTrainId);
      try {
        await updateTrainSchedulesTssId({
          body: {
            train_schedule_ids: formattedPacedTrainIds,
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
          filteredTimetableItems={filteredTimetableItems}
          timetableFilters={timetableFilters}
          timetableItems={timetableItems}
          selectedTimetableItemIds={selectedTimetableItemIds}
          showTrainDetails={showTrainDetails}
          isSelectMode={isSelectMode}
          setSelectedTimetableItemIds={setSelectedTimetableItemIds}
          setShowTrainDetails={setShowTrainDetails}
          setIsSelectMode={setIsSelectMode}
          setDisplayTimetableItemManagement={setDisplayTimetableItemManagement}
          refreshNge={refreshNge}
          handleDeleteTimetableItems={handleDeleteTimetableItems}
          handleMoveTimetableItems={() => openMoveDialog(selectedTimetableItemIds)}
          timetableMode={timetableMode}
          setTimetableMode={setTimetableMode}
          upsertTimetableItems={upsertTimetableItems}
        />
        <TrainList
          setDisplayTimetableItemManagement={setDisplayTimetableItemManagement}
          upsertTimetableItems={upsertTimetableItems}
          setTimetableItemToEditData={setTimetableItemToEditData}
          setSelectedTimetableItemIds={setSelectedTimetableItemIds}
          removeAndUnselectTrains={removeAndUnselectTrains}
          timetableItemToEditData={timetableItemToEditData}
          timetableItemsWithDetails={filteredTimetableItems}
          selectedTimetableItemIds={selectedTimetableItemIds}
          projectingOnSimulatedPathException={projectingOnSimulatedPathException}
          isSelectMode={isSelectMode}
          timetableMode={timetableMode}
          timetableItemsByTrainScheduleSets={timetableItemsByTrainScheduleSets}
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

      {showTrainScheduleMoveDialog && timetableItemsByTrainScheduleSets && (
        <TrainScheduleMoveDialog
          trainScheduleSets={timetableItemsByTrainScheduleSets.map((tss) => tss.trainScheduleSet)}
          setTrainScheduleSetIdSelected={setTrainScheduleSetIdSelected}
          trainScheduleSetIdSelected={trainScheduleSetIdSelected}
          catalogEntries={catalogEntries.filter((entry) =>
            timetableItemsByTrainScheduleSets.some(
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
