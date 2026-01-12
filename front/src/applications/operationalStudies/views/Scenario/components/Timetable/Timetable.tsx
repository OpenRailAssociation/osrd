import { useCallback, useState } from 'react';

import cx from 'classnames';
import { Virtualizer } from 'virtua';

import useScenarioTrainScheduleSet from 'applications/operationalStudies/hooks/useScenarioTrainScheduleSet';
import { ThreeDots } from 'common/Loaders';
import type { TimetableItemWithDetails } from 'modules/timetableItem/types';
import type {
  TimetableItemId,
  TimetableItem,
  TimetableItemToEditData,
} from 'reducers/osrdconf/types';
import { useAsyncMemo } from 'utils/useAsyncMemo';

import CalendarTrainList from './CalendarTrainList';
import TimetableToolbar from './TimetableToolbar';
import AddNewTrainScheduleSetTab from './TrainScheduleSet/AddNewTrainScheduleSetTab';
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
  const [showTrainScheduleSetDialog, setShowTrainScheduleSetDialog] = useState(false);

  const {
    timetableItemsWithDetails: mockedTimetableItemsWithDetails,
    getTrainSheculdeSetsFromTimetableItems,
  } = useScenarioTrainScheduleSet(timetableItemsWithDetails);

  const { filteredTimetableItems, ...timetableFilters } = useFilterTimetableItems(
    mockedTimetableItemsWithDetails
  );

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

  const trainScheduleSetsData = useAsyncMemo(
    () => getTrainSheculdeSetsFromTimetableItems(filteredTimetableItems),
    [filteredTimetableItems]
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
          <>
            {trainScheduleSetsData.type === 'ready' && (
              <Virtualizer overscan={15}>
                {trainScheduleSetsData.data.map(({ trainScheduleSet, catalog, trains }) => {
                  const trainScheduleSetTrainsIds = timetableItems.map((train) => train.id);
                  const isSelected = timetableItems.every((train) =>
                    selectedTimetableItemIds.includes(train.id)
                  );
                  const isIndeterminate =
                    !isSelected &&
                    timetableItems.some((train) => selectedTimetableItemIds.includes(train.id));

                  return (
                    <TrainScheduleSetTab
                      key={trainScheduleSet.id}
                      trainScheduleSet={trainScheduleSet}
                      catalogName={catalog?.name ?? undefined}
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
                        timetableItemsWithDetails={trains}
                        selectedTimetableItemIds={selectedTimetableItemIds}
                        projectingOnSimulatedPathException={projectingOnSimulatedPathException}
                        isSelectMode={isSelectMode}
                        timetableMode={timetableMode}
                      />
                    </TrainScheduleSetTab>
                  );
                })}
                <AddNewTrainScheduleSetTab onClick={() => setShowTrainScheduleSetDialog(true)} />
              </Virtualizer>
            )}
            {trainScheduleSetsData.type === 'loading' && <ThreeDots />}
          </>
        )}
      </div>
      {showTrainScheduleSetDialog && (
        <TrainScheduleSetDialog
          onCancel={() => {
            setShowTrainScheduleSetDialog(false);
          }}
        />
      )}
    </div>
  );
};

export default Timetable;
