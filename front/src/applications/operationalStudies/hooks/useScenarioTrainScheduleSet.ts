import { useCallback, useMemo } from 'react';

import {
  osrdEditoastApi,
  type CatalogEntry,
  type TrainScheduleSet,
} from 'common/api/osrdEditoastApi';
import type { TimetableItemWithDetails } from 'modules/timetableItem/types';

import { useScenarioContext } from './useScenarioContext';
import { sortTrainScheduleSets } from '../views/Scenario/components/Timetable/utils';

export type TrainScheduleSetFormData = Omit<TrainScheduleSet, 'catalog_entry_id' | 'id'> & {
  catalog?: { id: number; type: 'selected' } | { name: string; type: 'create' };
};

export default function useScenarioTrainScheduleSet(
  timetableItemsWithDetails: TimetableItemWithDetails[]
) {
  const { timetableId } = useScenarioContext();

  const { currentData: trainScheduleSets } =
    osrdEditoastApi.endpoints.getTimetableByIdTrainScheduleSets.useQuery({ id: timetableId });

  const { currentData: catalogEntries } = osrdEditoastApi.endpoints.getAllCatalogEntries.useQuery(
    {}
  );

  const [createCatalogEntryMutation] = osrdEditoastApi.endpoints.postCatalogEntries.useMutation();

  const [createTrainScheduleSetMutation] =
    osrdEditoastApi.endpoints.postTrainScheduleSets.useMutation();

  const [updateTrainScheduleSetMutation] =
    osrdEditoastApi.endpoints.putTrainScheduleSetsById.useMutation();

  const [linkTrainScheduleSetToTimetable] =
    osrdEditoastApi.endpoints.postTimetableByIdTrainScheduleSets.useMutation();

  const createTrainScheduleSet = useCallback(
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

      // When linking tss to a timetable, we need to provide the full list of tss ids otherwise
      // the missing ones are unlinked (needed when removing a local tss from a timetable)
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

  const removeTrainScheduleSet = useCallback(
    async (id: TrainScheduleSet['id']): Promise<void> => {
      // When linking train schedule sets to a timetable, the backend expects the full list of IDs.
      // Any ID not provided is automatically unlinked, so when removing one train schedule set
      // we must explicitly send all remaining IDs to avoid unlinking the others.
      await linkTrainScheduleSetToTimetable({
        id: timetableId,
        body: {
          train_schedule_set_ids:
            trainScheduleSets?.map((tss) => tss.id).filter((tssId) => tssId !== id) ?? [],
        },
      }).unwrap();
    },
    [timetableId, trainScheduleSets, linkTrainScheduleSetToTimetable]
  );

  const updateTrainScheduleSet = useCallback(
    async (trainScheduleSet: TrainScheduleSet, data: TrainScheduleSetFormData): Promise<void> => {
      let catalogEntryId = trainScheduleSet.catalog_entry_id;

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

      await updateTrainScheduleSetMutation({
        id: trainScheduleSet.id,
        trainScheduleSetForm: {
          ...trainScheduleSetData,
          catalog_entry_id: catalogEntryId,
        },
      }).unwrap();
    },
    [
      updateTrainScheduleSetMutation,
      createCatalogEntryMutation,
      linkTrainScheduleSetToTimetable,
      timetableId,
      trainScheduleSets,
    ]
  );

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

  return {
    catalogEntries: catalogEntries ?? [],
    timetableItemsByTrainScheduleSets,
    createTrainScheduleSet,
    updateTrainScheduleSet,
    removeTrainScheduleSet,
    publishTrainScheduleSet,
    localCopyTrainScheduleSet,
    getTrainScheduleSetByCatalogAndName,
  };
}
