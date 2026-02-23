import { useCallback, useState } from 'react';

import cx from 'classnames';
import { useTranslation } from 'react-i18next';
import { Virtualizer } from 'virtua';

import useScenarioTrainScheduleSet from 'applications/operationalStudies/hooks/useScenarioTrainScheduleSet';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { Loader } from 'common/Loaders';
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

import CalendarTrainList from './CalendarTrainList';
import TimetableToolbar from './TimetableToolbar';
import AddNewTrainScheduleSetTab from './TrainScheduleSet/AddNewTrainScheduleSetTab';
import TrainScheduleMoveDialog from './TrainScheduleSet/TrainScheduleMoveDialog';
import TrainScheduleSetDialog from './TrainScheduleSet/TrainScheduleSetDialog';
import TrainScheduleSetTab from './TrainScheduleSet/TrainScheduleSetTab';
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

  const [patchPacedTrainMove] = osrdEditoastApi.endpoints.patchPacedTrainMove.useMutation({});

  const [showTrainScheduleMoveDialog, setShowTrainScheduleMoveDialog] = useState(false);
  const [pacedTrainIdsToMove, setPacedTrainIdsToMove] = useState<PacedTrainId[]>([]);
  const [trainScheduleSetIdSelected, setTrainScheduleSetIdSelected] = useState<number>();

  const {
    timetableItemsByTrainScheduleSets,
    catalogEntries,
    createTrainScheduleSet,
    publishTrainScheduleSet,
    getTrainScheduleSetByCatalogAndName,
    localCopyTrainScheduleSet,
    updateTrainScheduleSet,
    removeTrainScheduleSet,
  } = useScenarioTrainScheduleSet(timetableItemsWithDetails, timetableItems, upsertTimetableItems);

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
        await patchPacedTrainMove({
          body: {
            paced_train_ids: formattedPacedTrainIds,
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
    [pacedTrainIdsToMove, patchPacedTrainMove, dispatch]
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
        {timetableMode === 'calendar' && (
          <Virtualizer overscan={15}>
            <CalendarTrainList
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
            />
          </Virtualizer>
        )}
        {timetableMode === 'trainScheduleSet' &&
          (timetableItemsByTrainScheduleSets ? (
            <Virtualizer overscan={15}>
              {timetableItemsByTrainScheduleSets.map(({ trainScheduleSet, catalog, trains }) => {
                const trainScheduleSetTrainsIds = trains.map((train) => train.id);
                const isSelected =
                  trains.length > 0 &&
                  trains.every((train) => selectedTimetableItemIds.includes(train.id));
                const isIndeterminate =
                  !isSelected &&
                  trains.some((train) => selectedTimetableItemIds.includes(train.id));
                const isCheckboxDisabled = trains.length === 0;
                return (
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
                    isTrainListOpen={expandedTrainScheduleSetIds.has(trainScheduleSet.id)}
                    catalogEntries={catalogEntries}
                    publishTrainScheduleSet={publishTrainScheduleSet}
                    getTrainScheduleSetByCatalogAndName={getTrainScheduleSetByCatalogAndName}
                    localCopyTrainScheduleSet={localCopyTrainScheduleSet}
                    updateTrainScheduleSet={updateTrainScheduleSet}
                    removeTrainScheduleSet={removeTrainScheduleSet}
                  >
                    <CalendarTrainList
                      setDisplayTimetableItemManagement={setDisplayTimetableItemManagement}
                      upsertTimetableItems={upsertTimetableItems}
                      setTimetableItemToEditData={setTimetableItemToEditData}
                      setSelectedTimetableItemIds={setSelectedTimetableItemIds}
                      removeAndUnselectTrains={removeAndUnselectTrains}
                      timetableItemToEditData={timetableItemToEditData}
                      timetableItemsWithDetails={trains}
                      selectedTimetableItemIds={selectedTimetableItemIds}
                      projectingOnSimulatedPathException={projectingOnSimulatedPathException}
                      isSelectMode={isSelectMode}
                      timetableMode={timetableMode}
                      moveTimetableItem={(pacedTrainIds) => openMoveDialog(pacedTrainIds)}
                    />
                  </TrainScheduleSetTab>
                );
              })}
              <AddNewTrainScheduleSetTab onClick={() => setShowTrainScheduleSetDialog(true)} />
            </Virtualizer>
          ) : (
            <Loader className="scenario-timetable-trainschedule-loader" />
          ))}
      </div>
      {showTrainScheduleSetDialog && (
        <TrainScheduleSetDialog
          catalogEntries={catalogEntries}
          onCancel={() => setShowTrainScheduleSetDialog(false)}
          onSubmit={createTrainScheduleSet}
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
