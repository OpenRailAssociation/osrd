import { useCallback, useMemo } from 'react';

import {
  osrdEditoastApi,
  type CatalogEntry,
  type TrainScheduleSet,
} from 'common/api/osrdEditoastApi';
import type { TimetableItemWithDetails } from 'modules/timetableItem/types';

import { useScenarioContext } from './useScenarioContext';
import { sortTrainScheduleSets } from '../views/Scenario/components/Timetable/utils';

// TODO: this type should be removed when unmocking this hook
export type TimetableItemWithDetailsAndTrainScheduleSet = TimetableItemWithDetails & {
  train_schedule_set_id: number;
};

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
  const [createCatalogEntryMutation] = osrdEditoastApi.endpoints.postCatalogEntries.useMutation();

  const [updateCatalogEntryMutation] =
    osrdEditoastApi.endpoints.putCatalogEntriesById.useMutation();

  const [deleteTrainScheduleSetMutation] =
    osrdEditoastApi.endpoints.deleteTrainScheduleSetsById.useMutation();

  /**
   * Retrieve a TainScheduleSet via its ID.
   */
  const getTrainScheduleSet = useCallback(
    (id: number) =>
      new Promise<TrainScheduleSet>((resolve, reject) => {
        const trainScheduleSet = trainScheduleSets?.find((e) => e.id === id);
        if (trainScheduleSet) resolve(trainScheduleSet);
        else return reject('not found');
      }),
    [trainScheduleSets]
  );

  /**
   * Create a new TrainScheduleSet
   */
  const [createTrainScheduleSetMutation] =
    osrdEditoastApi.endpoints.postTrainScheduleSets.useMutation();

  const [linkTrainScheduleSetToTimetable] =
    osrdEditoastApi.endpoints.postTimetableByIdTrainScheduleSets.useMutation();

  const [updateTrainScheduleSetMutation] =
    osrdEditoastApi.endpoints.putTrainScheduleSetsById.useMutation();

  const createTrainScheduleSet = useCallback(
    // update for create catalog
    async (data: TrainScheduleSetFormData): Promise<void> => {
      let catalogEntryId: number | undefined;

      const { catalog, ...trainScheduleSetData } = data;

      if (catalog) {
        if (catalog.type === 'selected') {
          catalogEntryId = catalog.id;
        }

        if (catalog.type === 'create') {
          const newCatalog = await createCatalogEntryMutation({
            catalogEntryForm: { name: catalog.name },
          }).unwrap();
          catalogEntryId = newCatalog.id;
        }
      }

      const newTss = await createTrainScheduleSetMutation({
        trainScheduleSetForm: {
          ...trainScheduleSetData,
          catalog_entry_id: catalogEntryId,
        },
      }).unwrap();
      await linkTrainScheduleSetToTimetable({
        id: timetableId,
        body: {
          train_schedule_set_ids: [...(trainScheduleSets?.map((tss) => tss.id) ?? []), newTss.id],
        },
      }).unwrap();
    },
    [
      createTrainScheduleSetMutation,
      createCatalogEntryMutation,
      linkTrainScheduleSetToTimetable,
      timetableId,
      trainScheduleSets,
    ]
  );

  /**
   * Remove a TainScheduleSet from the timetable.
   */
  const removeTrainScheduleSet = useCallback(
    async (id: TrainScheduleSet['id']): Promise<void> => {
      await deleteTrainScheduleSetMutation({ id }).unwrap();

      await linkTrainScheduleSetToTimetable({
        id: timetableId,
        body: {
          train_schedule_set_ids:
            trainScheduleSets?.map((tss) => tss.id).filter((tssId) => tssId !== id) ?? [],
        },
      }).unwrap();
    },
    [
      deleteTrainScheduleSetMutation,
      linkTrainScheduleSetToTimetable,
      timetableId,
      trainScheduleSets,
    ]
  );

  /**
   * Update a TrainScheduleSet
   */
  const updateTrainScheduleSet = useCallback(
    async (trainScheduleSet: TrainScheduleSet, data: TrainScheduleSetFormData): Promise<void> => {
      let catalogEntryId = trainScheduleSet.catalog_entry_id;

      const { catalog, ...trainScheduleSetData } = data;

      if (catalog) {
        if (catalog.type === 'selected') {
          catalogEntryId = catalog.id;
        }

        if (catalog.type === 'create') {
          if (catalogEntryId) {
            await updateCatalogEntryMutation({
              id: catalogEntryId,
              catalogEntryForm: { name: catalog.name },
            }).unwrap();
          } else {
            const newCatalog = await createCatalogEntryMutation({
              catalogEntryForm: { name: catalog.name },
            }).unwrap();

            catalogEntryId = newCatalog.id;
          }
        }
      }

      await updateTrainScheduleSetMutation({
        id: trainScheduleSet.id,
        trainScheduleSetForm: {
          ...trainScheduleSetData,
          catalog_entry_id: catalogEntryId,
        },
      }).unwrap();
      await linkTrainScheduleSetToTimetable({
        id: timetableId,
        body: {
          train_schedule_set_ids: trainScheduleSets?.map((tss) => tss.id) ?? [],
        },
      }).unwrap();
    },
    [
      updateTrainScheduleSetMutation,
      createCatalogEntryMutation,
      updateCatalogEntryMutation,
      trainScheduleSets,
    ]
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
          const found = trainScheduleSets?.find((e) => e.id === trainScheduleSet.id);
          if (!found) return reject('Not found');
          return resolve();
        }, 1000);
      }),
    []
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
          store: trainScheduleSets,
        });
        setTimeout(async () => {
          const found = trainScheduleSets?.find(
            (tss) => tss.catalog_entry_id === catalogId && tss.name === name
          );
          return resolve(found || null);
        }, 1000);
      }),
    [trainScheduleSets]
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
    []
  );

  const timetableItemsByTrainScheduleSets = useMemo(() => {
    if (!trainScheduleSets) return [];

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

  return {
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
