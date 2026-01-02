import { useCallback, useState } from 'react';

import cx from 'classnames';
import { Virtualizer } from 'virtua';

import type { TimetableItemWithDetails } from 'modules/timetableItem/types';
import type {
  TimetableItemId,
  TimetableItem,
  TimetableItemToEditData,
} from 'reducers/osrdconf/types';

import CalendarTrainList from './CalendarTrainList';
import TimetableToolbar from './TimetableToolbar';
import TrainScheduleSetTab from './TrainScheduleSetTab';
import type { TimetableMode } from './types';
import useFilterTimetableItems from './useFilterTimetableItems';
import { sortTrainScheduleSets } from './utils';
import { MOCK_CATALOG, MOCK_TRAIN_SCHEDULE_SETS } from '../../mockTrainScheduleSets';

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
  selectedTimetableItemIds,
  projectingOnSimulatedPathException,
}: TimetableProps) => {
  const [showTrainDetails, setShowTrainDetails] = useState(false);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [timetableMode, setTimetableMode] = useState<TimetableMode>('calendar');
  const [expandedTrainScheduleSetIds, setExpandedTrainScheduleSetIds] = useState<Set<number>>(
    new Set()
  );

  const { filteredTimetableItems, ...timetableFilters } =
    useFilterTimetableItems(timetableItemsWithDetails);

  // TODO Package : replace this by a useMemo when back endpoint ready
  const catalogEntryNameById = new Map<number, string>();
  MOCK_CATALOG.forEach((entry) => {
    if (!entry.name) return;
    catalogEntryNameById.set(entry.id, entry.name);
  });

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
          refreshNge={() => Promise.resolve()}
          handleDeleteTimetableItems={handleDeleteTimetableItems}
          timetableMode={timetableMode}
          setTimetableMode={setTimetableMode}
        />
        {timetableMode === 'calendar' ? (
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
        ) : (
          <Virtualizer overscan={15}>
            {MOCK_TRAIN_SCHEDULE_SETS.length > 0 &&
              MOCK_TRAIN_SCHEDULE_SETS
                // TODO Package : extract the sort part in a useMemo when back endpoint ready
                .sort((a, b) => sortTrainScheduleSets(a, b, catalogEntryNameById))
                .map((trainScheduleSet) => {
                  // TODO Package : filter trains depending on their true train_schedule_set_id when back ready
                  const trainScheduleSetTrains = filteredTimetableItems
                    .map((item, i) => ({
                      ...item,
                      train_schedule_set_id: (i % 12) + 1,
                    }))
                    .filter((train) => train.train_schedule_set_id === trainScheduleSet.id);
                  const trainScheduleSetTrainsIds = trainScheduleSetTrains.map((train) => train.id);
                  const isSelected = trainScheduleSetTrains.every((train) =>
                    selectedTimetableItemIds.includes(train.id)
                  );
                  const isIndeterminate =
                    !isSelected &&
                    trainScheduleSetTrains.some((train) =>
                      selectedTimetableItemIds.includes(train.id)
                    );
                  const catalogName =
                    MOCK_CATALOG.find((entry) => entry.id === trainScheduleSet.catalog_entry_id)
                      ?.name ?? '';

                  return (
                    <TrainScheduleSetTab
                      key={trainScheduleSet.id}
                      trainScheduleSet={trainScheduleSet}
                      catalogName={catalogName}
                      handleClickTrainScheduleSet={handleClickTrainScheduleSet}
                      handleSelectTrainScheduleSet={() =>
                        handleSelectTrainScheduleSet(trainScheduleSetTrainsIds)
                      }
                      isSelectMode={isSelectMode}
                      isSelected={isSelected}
                      isIndeterminate={isIndeterminate}
                      isTrainListOpen={expandedTrainScheduleSetIds.has(trainScheduleSet.id)}
                    >
                      <CalendarTrainList
                        setDisplayTimetableItemManagement={setDisplayTimetableItemManagement}
                        upsertTimetableItems={upsertTimetableItems}
                        setTimetableItemToEditData={setTimetableItemToEditData}
                        setSelectedTimetableItemIds={setSelectedTimetableItemIds}
                        removeAndUnselectTrains={removeAndUnselectTrains}
                        timetableItemToEditData={timetableItemToEditData}
                        timetableItemsWithDetails={trainScheduleSetTrains}
                        selectedTimetableItemIds={selectedTimetableItemIds}
                        projectingOnSimulatedPathException={projectingOnSimulatedPathException}
                        isSelectMode={isSelectMode}
                        timetableMode={timetableMode}
                      />
                    </TrainScheduleSetTab>
                  );
                })}
          </Virtualizer>
        )}
      </div>
    </div>
  );
};

export default Timetable;
