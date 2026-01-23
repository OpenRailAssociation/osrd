import { useCallback, useEffect, useMemo, useState } from 'react';

import { maxBy } from 'lodash';

import {
  osrdEditoastApi,
  type CatalogEntry,
  type TrainScheduleSet,
} from 'common/api/osrdEditoastApi';
import type { TimetableItemWithDetails } from 'modules/timetableItem/types';

import { useScenarioContext } from './useScenarioContext';
import { sortTrainScheduleSets } from '../views/Scenario/components/Timetable/utils';
import {
  MOCK_CATALOG,
  MOCK_TRAIN_SCHEDULE_SETS,
  randomArrayElement,
} from '../views/Scenario/mockTrainScheduleSets';

// TODO: this type should be removed when unmocking this hook
export type TimetableItemWithDetailsAndTrainScheduleSet = TimetableItemWithDetails & {
  train_schedule_set_id: number;
};

type MockStore = {
  timetableItemsWithDetails: TimetableItemWithDetailsAndTrainScheduleSet[];
  catalog: CatalogEntry[];
  trainScheduleSets: TrainScheduleSet[];
};

const TRAIN_SCHEDULE_SET_SANDBOX_ID = 1000;

export type TrainScheduleSetFormData = Omit<TrainScheduleSet, 'catalog_entry_id' | 'id'> & {
  catalog?: { id: number; type: 'selected' } | { name: string; type: 'create' };
};

/**
 * Hook that handles operations on TrainScheduleSet for a scenario.
 * For now it is mocked everywhere, but should be replaced when editoast will be ready.
 *
 * TODO: on unmock the `timetableItemsWithDetails` argument should be removed.
 * It is there only to add the `train_schedule_set_id`
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
          return { ...item, train_schedule_set_id: TRAIN_SCHEDULE_SET_SANDBOX_ID };
        }
        return { ...item, train_schedule_set_id: randomArrayElement(MOCK_TRAIN_SCHEDULE_SETS).id };
      });
      return { ...prev, timetableItemsWithDetails: timetableItems };
    });
  }, [timetableItemsWithDetails]);

  /**
   * Retrieve all TrainScheduleSets of the timetable
   */
  const { currentData: trainScheduleSets } =
    osrdEditoastApi.endpoints.getTimetableByIdTrainScheduleSets.useQuery({ id: timetableId });

  /**
   * Retrieve all catalog entries
   */
  const { currentData: catalogEntries } = osrdEditoastApi.endpoints.getAllCatalogEntries.useQuery(
    {}
  );

  /**
   * Retrieve all catalog entries
   */
  const createCatalogEntry = useCallback(
    (name: string) =>
      new Promise<CatalogEntry>((resolve) => {
        setTimeout(() => {
          console.warn('Mocked: createCatalogEntry');
          const catalogId = (maxBy(mockStore.catalog, 'id')?.id || 1) + 1;
          const catalogEntry = { id: catalogId, name };
          setMockStore((prev) => ({ ...prev, catalog: [...prev.catalog, catalogEntry] }));
          resolve(catalogEntry);
        }, 1000);
      }),
    [mockStore.catalog]
  );

  /**
   * Given a list of TimetableItem, returns the associates list of TranscheduleSet,
   * each one associates with its list of timetable item and its catalog entry.
   */
  const timetableItemsByTrainScheduleSets = useMemo(() => {
    if (!trainScheduleSets) return null;

    // We group trains by trainScheduleSet
    const trainsByTrainScheduleSetId = new Map<number, TimetableItemWithDetails[]>();
    for (const item of timetableItemsWithDetails) {
      const itemInIndex = trainsByTrainScheduleSetId.get(item.train_schedule_set_id);
      if (!itemInIndex) {
        trainsByTrainScheduleSetId.set(item.train_schedule_set_id, [item]);
      } else {
        trainsByTrainScheduleSetId.set(item.train_schedule_set_id, [...itemInIndex, item]);
      }
    }

    const trainScheduleSetsById = new Map<number, TrainScheduleSet>();
    for (const trainScheduleSet of trainScheduleSets) {
      trainScheduleSetsById.set(trainScheduleSet.id, trainScheduleSet);
    }

    const catalogEntriesIndex = new Map<number, CatalogEntry>();
    if (catalogEntries) {
      for (const catalogEntry of catalogEntries) {
        catalogEntriesIndex.set(catalogEntry.id, catalogEntry);
      }
    }

    return Array.from(trainScheduleSetsById.values())
      .sort((a, b) => sortTrainScheduleSets(a, b, catalogEntriesIndex))
      .map((trainScheduleSet) => ({
        trainScheduleSet,
        trains: trainsByTrainScheduleSetId.get(trainScheduleSet.id) || [],
        catalog: trainScheduleSet.catalog_entry_id
          ? catalogEntriesIndex.get(trainScheduleSet.catalog_entry_id)
          : undefined, // can happen if it's the sandbox
      }));
  }, [trainScheduleSets, catalogEntries, timetableItemsWithDetails]);

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
          else return reject('not found');
        }, 1000);
      }),
    [mockStore.trainScheduleSets]
  );

  /**
   * Remove a TainScheduleSet from the timetable.
   */
  const removeTrainScheduleSet = useCallback(
    (id: TrainScheduleSet['id']) =>
      new Promise<void>((resolve, reject) => {
        setTimeout(() => {
          console.warn('Mocked: removeTrainSchedule', id);

          const found = mockStore.trainScheduleSets.find((e) => e.id === id);
          if (!found) return reject('not found');

          setMockStore((prev) => ({
            ...prev,
            trainScheduleSets: prev.trainScheduleSets.filter((e) => e.id !== id),
            // TODO: this part is just for the mock
            // In production, we just have to call the API to delete the TSS, the backend will do all the needed tasks.
            // But here, instead of deleting everything like it should be, we put them in the sandbox.
            timetableItemsWithDetails: prev.timetableItemsWithDetails.map((item) => {
              if (item.train_schedule_set_id !== id) return item;
              return { ...item, train_schedule_set_id: TRAIN_SCHEDULE_SET_SANDBOX_ID };
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
    (data: TrainScheduleSetFormData) =>
      new Promise<void>((resolve) => {
        console.warn('Mocked: createTrainScheduleSet', data);
        setTimeout(async () => {
          // Create the catalog entry if needed
          let catalogEntryId = TRAIN_SCHEDULE_SET_SANDBOX_ID;
          if (data.catalog) {
            if (data.catalog.type === 'create') {
              const catalogEntry = await createCatalogEntry(data.catalog.name);
              catalogEntryId = catalogEntry.id;
            } else {
              catalogEntryId = data.catalog.id;
            }
          }

          const trainScheduleSetId = (maxBy(mockStore.trainScheduleSets, 'id')?.id || 1) + 1;
          const trainScheduleSet = {
            id: trainScheduleSetId,
            ...data,
            published: false,
            catalog_entry_id: catalogEntryId,
          };
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
    (trainScheduleSet: TrainScheduleSet, data: TrainScheduleSetFormData) =>
      new Promise<void>((resolve, reject) => {
        console.warn('Mocked: updateTrainSchedule', { trainScheduleSet, data });
        setTimeout(async () => {
          const found = mockStore.trainScheduleSets.find((e) => e.id === trainScheduleSet.id);
          if (!found) return reject('not found');

          // Create the catalog entry if needed
          let catalogEntryId = TRAIN_SCHEDULE_SET_SANDBOX_ID;
          if (data.catalog) {
            if (data.catalog.type === 'create') {
              const catalogEntry = await createCatalogEntry(data.catalog.name);
              catalogEntryId = catalogEntry.id;
            } else {
              catalogEntryId = data.catalog.id;
            }
          }
          setMockStore((prev) => ({
            ...prev,
            trainScheduleSets: [
              ...prev.trainScheduleSets.filter((e) => e.id !== trainScheduleSet.id),
              { ...trainScheduleSet, ...data, catalog_entry_id: catalogEntryId },
            ],
          }));
          return resolve();
        }, 1000);
      }),
    [mockStore]
  );

  /**
   * Make a local copy of the TrainScheduleSet
   */
  const localCopyTrainScheduleSet = useCallback(
    (trainScheduleSet: TrainScheduleSet) =>
      new Promise<void>((resolve, reject) => {
        console.warn('Mocked: localCopyTrainScheduleSet', { trainScheduleSet });
        setTimeout(() => {
          if (!trainScheduleSet.catalog_entry_id)
            return reject('Train Schedule Set is not a reference');
          const found = mockStore.trainScheduleSets.find((e) => e.id === trainScheduleSet.id);
          if (!found) return reject('Not found');

          // Create the copy
          const copyTrainScheduleSetId = (maxBy(mockStore.trainScheduleSets, 'id')?.id || 1) + 1;
          const copyTrainScheduleSet = {
            ...trainScheduleSet,
            id: copyTrainScheduleSetId,
            published: false,
          };

          // Update the store
          setMockStore((prev) => ({
            ...prev,
            trainScheduleSets: [
              ...prev.trainScheduleSets.filter((e) => e.id !== trainScheduleSet.id),
              copyTrainScheduleSet,
            ],
            // Update items with the TSS copy ID
            timetableItemsWithDetails: prev.timetableItemsWithDetails.map((item) => ({
              ...item,
              train_schedule_set_id:
                item.train_schedule_set_id === trainScheduleSet.id
                  ? copyTrainScheduleSetId
                  : item.train_schedule_set_id,
            })),
          }));
          return resolve();
        }, 1000);
      }),
    [mockStore]
  );

  /**
   * Retrieve a trainsschedule set by its name and its catalog.
   * This function is used to check the unicity of the couple name/catalog.
   */
  const getTrainScheduleSetByCatalogAndName = useCallback(
    async (name: string, catalogId: number) =>
      new Promise<TrainScheduleSet | null>((resolve) => {
        console.warn('Mocked: getTrainScheduleSetByCatalogAndName', {
          name,
          catalogId,
          store: mockStore.trainScheduleSets,
        });
        setTimeout(async () => {
          const found = mockStore.trainScheduleSets.find(
            (tss) => tss.catalog_entry_id === catalogId && tss.name === name
          );
          return resolve(found || null);
        }, 1000);
      }),
    [mockStore.trainScheduleSets]
  );

  /**
   * Publish a TrainScheduleSet
   */
  const publishTrainScheduleSet = useCallback(
    (trainScheduleSet: TrainScheduleSet, data: TrainScheduleSetFormData) =>
      new Promise<void>((resolve, reject) => {
        console.warn('Mocked: publishTrainScheduleSet', { trainScheduleSet });
        setTimeout(async () => {
          // Do some check
          if (trainScheduleSet.published) return reject('Train Schedule Set is already published');
          if (!data.catalog)
            return reject('A catalog is required to publish the Train Schedule Set');
          if (!data.name) return reject('A name is required to publish the Train Schedule Set');
          if (data.name && 'id' in data.catalog) {
            const foundSameName = await getTrainScheduleSetByCatalogAndName(
              data.name,
              data.catalog.id
            );
            if (foundSameName && foundSameName.id !== trainScheduleSet.id)
              return reject(`Name ${data.name} is already in used in train set ${data.catalog.id}`);
          }

          // Update the Train Schedule Set
          await updateTrainScheduleSet(trainScheduleSet, { ...data, published: true });

          return resolve();
        }, 1000);
      }),
    [mockStore]
  );

  return {
    timetableItemsWithDetails: mockStore.timetableItemsWithDetails,
    catalogEntries: catalogEntries ?? [],
    timetableItemsByTrainScheduleSets,
    getTrainScheduleSet,
    createTrainScheduleSet,
    updateTrainScheduleSet,
    removeTrainScheduleSet,
    publishTrainScheduleSet,
    localCopyTrainScheduleSet,
    getTrainScheduleSetByCatalogAndName,
  };
}
