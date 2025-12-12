import { useCallback, useState } from 'react';

import cx from 'classnames';

import type { TrainScheduleSet } from 'common/api/osrdEditoastApi';
import type { TimetableItemWithDetails } from 'modules/timetableItem/types';
import type {
  TimetableItemId,
  TimetableItem,
  TimetableItemToEditData,
} from 'reducers/osrdconf/types';

import CalendarTrainList from './CalendarTrainList';
import TimetableToolbar from './TimetableToolbar';
import TrainScheduleSetTab from './TrainScheduleSetTab';
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
  const [timetableMode, setTimetableMode] = useState<'calendar' | 'package'>('calendar');
  const [expandedTrainScheduleSetIds, setExpandedTrainScheduleSetIds] = useState<Set<number>>(
    new Set()
  );

  // TODO Package : replace this by the endpoint when back ready
  const trainScheduleSets: TrainScheduleSet[] = [
    {
      id: 0,
      description: '',
      name: null,
      published: false,
    },
  ];

  const { filteredTimetableItems, ...timetableFilters } =
    useFilterTimetableItems(timetableItemsWithDetails);

  const handleClickPackage = useCallback(
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

  const handleSelectPackage = useCallback(
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
          />
        ) : (
          trainScheduleSets.length > 0 &&
          trainScheduleSets.map((trainScheduleSet) => {
            // TODO Package : filter trains depending on their train_schedule_set_id when back ready
            const trainScheduleSetTrains = [...filteredTimetableItems];
            const trainScheduleSetTrainsIds = trainScheduleSetTrains.map((train) => train.id);
            const isSelected = trainScheduleSetTrains.every((train) =>
              selectedTimetableItemIds.includes(train.id)
            );
            const isIndeterminate =
              !isSelected &&
              trainScheduleSetTrains.some((train) => selectedTimetableItemIds.includes(train.id));

            return (
              <TrainScheduleSetTab
                key={trainScheduleSet.id}
                trainScheduleSet={trainScheduleSet}
                handleClickPackage={handleClickPackage}
                handleSelectPackage={() => handleSelectPackage(trainScheduleSetTrainsIds)}
                isSelectMode={isSelectMode}
                isSelected={isSelected}
                isIndeterminate={isIndeterminate}
                isTrainListOpen={expandedTrainScheduleSetIds.has(0)}
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
                />
              </TrainScheduleSetTab>
            );
          })
        )}
      </div>
    </div>
  );
};

export default Timetable;
