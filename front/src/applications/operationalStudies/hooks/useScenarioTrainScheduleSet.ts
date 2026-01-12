import { useCallback, useEffect, useState } from 'react';

import { maxBy } from 'lodash';

import type { CatalogEntry, TrainScheduleSet } from 'common/api/osrdEditoastApi';
import type { TimetableItemWithDetails } from 'modules/timetableItem/types';

import { useScenarioContext } from './useScenarioContext';
import { sortTrainScheduleSets } from '../views/Scenario/components/Timetable/utils';
import {
  MOCK_CATALOG,
  MOCK_TRAIN_SCHEDULE_SETS,
  randomArrayElement,
} from '../views/Scenario/mockTrainScheduleSets';

type TimetableItemWithDetailsAndTrainScheduleSet = TimetableItemWithDetails & {
  train_schedule_set_id?: number;
};

type MockStore = {
  timetableItemsWithDetails: TimetableItemWithDetailsAndTrainScheduleSet[];
  catalog: CatalogEntry[];
  trainScheduleSets: TrainScheduleSet[];
};

const TRAIN_SCHEDULE_SET_SANDBOX_ID = 1000;

/**
 * Hook that handles operations on TrainScheduleSet for a scenario.
 * For now it is mocked everywhere, but should be replaced when editoast will be ready.
 */
export default function useScenarioTrainScheduleSet(
  timetableItemsWithDetails: TimetableItemWithDetails[]
) {
  // The timetableId will be used when unmocked this hook to call the API
  const { timetableId } = useScenarioContext();

  // Store where we manage mocked data
  const [mockStore, setMockStore] = useState<MockStore>({
    timetableItemsWithDetails: [],
    catalog: [...MOCK_CATALOG],
    trainScheduleSets: [...MOCK_TRAIN_SCHEDULE_SETS],
  });

  useEffect(() => {
    setMockStore((prev) => {
      const timetableItems = timetableItemsWithDetails.map((item) => {
        if (Math.random() > 0.9) {
          return { ...item, train_schedule_set_id: undefined };
        }
        return { ...item, train_schedule_set_id: randomArrayElement(MOCK_TRAIN_SCHEDULE_SETS).id };
      });
      return { ...prev, timetableItemsWithDetails: timetableItems };
    });
  }, [timetableItemsWithDetails]);

  /**
   * Retrieve all TainScheduleSets
   */
  const getAllTrainScheduleSets = useCallback(
    () =>
      new Promise<TrainScheduleSet[]>((resolve) => {
        setTimeout(() => {
          console.warn('Mocked: getAllTrainScheduleSets');
          resolve(mockStore.trainScheduleSets);
        }, 1000);
      }),
    [mockStore.trainScheduleSets]
  );

  /**
   * Retrieve all catalog entries
   */
  const getAllCatalogEntries = useCallback(
    () =>
      new Promise<CatalogEntry[]>((resolve) => {
        setTimeout(() => {
          console.warn('Mocked: getAllCatalogEntries');
          resolve(mockStore.catalog);
        }, 1000);
      }),
    [mockStore]
  );

  /**
   * Given a list of TimetableItem, returns the associates list of TranscheduleSet,
   * each one associates with its list of TimetableItem.
   *
   * NB: on unmock, this function should be reviewed for better performances:
   * - keep track of catalog and trainsScheduleSet with a cache mecasnim ?
   * - calling the full catalog in one query (even if we need only one). Same for TSS.
   */
  const getTrainSheculdeSetsFromTimetableItems = useCallback(
    async (items: TimetableItemWithDetailsAndTrainScheduleSet[]) => {
      // We group trains by trainScheduleSet
      const itemsByTrainScheduleSetId: Record<number, TimetableItemWithDetails[]> = {};
      for (const item of items) {
        if (item.train_schedule_set_id !== undefined) {
          itemsByTrainScheduleSetId[item.train_schedule_set_id] = [
            ...(itemsByTrainScheduleSetId[item.train_schedule_set_id] || []),
            item,
          ];
        } else {
          // We use -1 as ID for sandbox
          itemsByTrainScheduleSetId[TRAIN_SCHEDULE_SET_SANDBOX_ID] = [
            ...(itemsByTrainScheduleSetId[TRAIN_SCHEDULE_SET_SANDBOX_ID] || []),
            item,
          ];
        }
      }

      // Calling the API to get TrainScheduleSet data
      const trainScheduleSets = await getAllTrainScheduleSets();
      const trainScheduleSetsById = trainScheduleSets.reduce(
        (acc, curr) => ({ ...acc, [curr.id]: curr }),
        {} as Record<number, TrainScheduleSet>
      );

      // Calling the API to get Catalog data
      const catalogEntries = await getAllCatalogEntries();
      const catalogEntriesIndex = catalogEntries.reduce(
        (acc, curr) => ({ ...acc, [curr.id]: curr }),
        {} as Record<number, CatalogEntry>
      );
      const catalogEntryNameById = new Map<number, string>();
      Object.values(catalogEntriesIndex).map((entry) => {
        if (!entry.name) return;
        catalogEntryNameById.set(entry.id, entry.name);
      });

      return [
        ...Object.keys(trainScheduleSetsById)
          .map((id) => {
            const tssId = parseInt(id);
            return trainScheduleSetsById[tssId];
          })
          .sort((a, b) => sortTrainScheduleSets(a, b, catalogEntryNameById))
          .map((trainScheduleSet) => ({
            trainScheduleSet,
            trains: itemsByTrainScheduleSetId[trainScheduleSet.id],
            catalog: trainScheduleSet.catalog_entry_id
              ? catalogEntriesIndex[trainScheduleSet.catalog_entry_id]
              : undefined,
          })),
        {
          trainScheduleSet: {
            id: TRAIN_SCHEDULE_SET_SANDBOX_ID,
            published: false,
            description: 'Sandbox',
          },
          trains: itemsByTrainScheduleSetId[TRAIN_SCHEDULE_SET_SANDBOX_ID] || [],
          catalog: undefined,
        },
      ];
    },
    [getAllTrainScheduleSets, getAllCatalogEntries]
  );

  /**
   * Retrieve a TainScheduleSet via its ID.
   */
  const getTrainScheduleSet = useCallback(
    (id: number) =>
      new Promise<TrainScheduleSet>((resolve, reject) => {
        console.warn('Mocked: getTrainScheduleSet');
        setTimeout(() => {
          const trainScheduleSet = mockStore.trainScheduleSets.find((e) => e.id === id);
          if (trainScheduleSet) resolve(trainScheduleSet);
          else reject('not found');
        }, 1000);
      }),
    [mockStore.trainScheduleSets]
  );

  /**
   * Remove a TainScheduleSet from the timetable.
   */
  const removeTrainScheduleSet = useCallback(
    (trainScheduleSet: TrainScheduleSet) =>
      new Promise<void>((resolve, reject) => {
        setTimeout(() => {
          console.warn('Mocked: removeTrainSchedule', {
            trainScheduleSet,
          });
          const found = mockStore.trainScheduleSets.find((e) => e.id === trainScheduleSet.id);
          if (!found) reject('not found');
          setMockStore((prev) => ({
            ...prev,
            trainScheduleSets: prev.trainScheduleSets.filter((e) => e.id !== trainScheduleSet.id),
            timetableItemsWithDetails: prev.timetableItemsWithDetails.map((item) => {
              if (item.train_schedule_set_id !== trainScheduleSet.id) return item;
              return { ...item, train_schedule_set_id: undefined };
            }),
          }));
          resolve();
        }, 1000);
      }),
    [timetableId, mockStore]
  );

  /**
   * Create a new TrainScheduleSet
   */
  const createTrainScheduleSet = useCallback(
    (data: Omit<TrainScheduleSet, 'id'>) =>
      new Promise<void>((resolve) => {
        console.warn('Mocked: createTrainScheduleSet', data);
        setTimeout(() => {
          const trainScheduleSetId = (maxBy(mockStore.trainScheduleSets, 'id')?.id || 1) + 1;
          const trainScheduleSet = { id: trainScheduleSetId, ...data };
          setMockStore((prev) => ({
            ...prev,
            trainScheduleSets: [
              ...prev.trainScheduleSets.filter((e) => e.id !== trainScheduleSet.id),
              trainScheduleSet,
            ],
          }));
          resolve();
        }, 1000);
      }),
    [mockStore]
  );

  /**
   * Update a TrainScheduleSet
   */
  const updateTrainScheduleSet = useCallback(
    (trainScheduleSet: TrainScheduleSet, data: Omit<TrainScheduleSet, 'id'>) =>
      new Promise<void>((resolve, reject) => {
        console.warn('Mocked: updateTrainSchedule', { trainScheduleSet, data });
        setTimeout(() => {
          const found = mockStore.trainScheduleSets.find((e) => e.id === trainScheduleSet.id);
          if (!found) reject('not found');
          setMockStore((prev) => ({
            ...prev,
            trainScheduleSets: [
              ...prev.trainScheduleSets.filter((e) => e.id !== trainScheduleSet.id),
              { ...trainScheduleSet, ...data },
            ],
          }));
          resolve();
        }, 1000);
      }),
    [mockStore]
  );

  return {
    timetableItemsWithDetails: mockStore.timetableItemsWithDetails,
    getTrainSheculdeSetsFromTimetableItems,
    getTrainScheduleSet,
    createTrainScheduleSet,
    updateTrainScheduleSet,
    removeTrainScheduleSet,
  };
}
