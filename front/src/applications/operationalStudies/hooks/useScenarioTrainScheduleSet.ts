import { useCallback, useMemo } from 'react';

import { useTranslation } from 'react-i18next';

import { useTimetableContext } from 'applications/operationalStudies/hooks/useTimetableContext';
import {
  osrdEditoastApi,
  type CatalogEntry,
  type TrainSchedule,
  type TrainScheduleSet,
} from 'common/api/osrdEditoastApi';
import { createTrainSchedules } from 'modules/trainSchedule/helpers/updateTrainScheduleHelpers';
import type { TrainScheduleWithDetails } from 'modules/trainSchedule/types';
import { useAppDispatch } from 'store';

import type { TrainScheduleSetImportType } from '../views/Scenario/components/ImportTrainScheduleSets/types';
import { sortTrainScheduleSets } from '../views/Scenario/components/Timetable/utils';
import { useScenarioContext } from './useScenarioContext';

// The timetable type is not part of the form: a train schedule set inherits it from the timetable
// it is created in, and it can never be updated afterwards (a set must stay homogeneous).
export type TrainScheduleSetFormData = Omit<
  TrainScheduleSet,
  'catalog_entry_id' | 'id' | 'timetable_type'
> & {
  catalog?: { id: number; type: 'selected' } | { name: string; type: 'create' };
};

export type ImportTrainScheduleSetsPayload = Array<{
  type: TrainScheduleSetImportType;
  trainScheduleSet: TrainScheduleSet;
}>;

export type TrainSchedulesByTrainScheduleSet = {
  trainScheduleSet: TrainScheduleSet;
  trains: TrainScheduleWithDetails[];
  catalog?: CatalogEntry;
};

export type TrainScheduleSetManager = {
  createSet: (data: TrainScheduleSetFormData) => Promise<void>;
  publishSet: (trainScheduleSet: TrainScheduleSet, data: TrainScheduleSetFormData) => Promise<void>;
  getSetByCatalogAndName: (name: string, catalogId: number) => TrainScheduleSet | null;
  localCopySet: (trainScheduleSet: TrainScheduleSet) => Promise<void>;
  updateSet: (trainScheduleSet: TrainScheduleSet, data: TrainScheduleSetFormData) => Promise<void>;
  removeSet: (id: number) => Promise<void>;
};

export default function useScenarioTrainScheduleSet(
  trainSchedulesWithDetails: TrainScheduleWithDetails[]
) {
  const { t } = useTranslation('operational-studies', {
    keyPrefix: 'main.timetable.trainScheduleSets.error',
  });

  const { timetableId, scenario } = useScenarioContext();
  const { trainSchedules, upsertTrainSchedules } = useTimetableContext();

  const { currentData: trainScheduleSets } =
    osrdEditoastApi.endpoints.getTimetableByIdTrainScheduleSets.useQuery({ id: timetableId });

  const { currentData: catalogEntries } = osrdEditoastApi.endpoints.getAllCatalogEntries.useQuery(
    {}
  );

  const dispatch = useAppDispatch();

  const [createCatalogEntryMutation] = osrdEditoastApi.endpoints.postCatalogEntries.useMutation();

  const [createTrainScheduleSetMutation] =
    osrdEditoastApi.endpoints.postTrainScheduleSets.useMutation();

  const [updateTrainScheduleSetMutation] =
    osrdEditoastApi.endpoints.putTrainScheduleSetsById.useMutation();

  const [linkTrainScheduleSetToTimetable] =
    osrdEditoastApi.endpoints.postTimetableByIdTrainScheduleSets.useMutation();

  const [getTrainScheduleSetTrainSchedules] =
    osrdEditoastApi.endpoints.getTrainScheduleSetsByIdTrainSchedules.useLazyQuery();

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
          timetable_type: scenario.timetable_type,
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
      scenario.timetable_type,
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
        trainScheduleSetUpdateForm: {
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
    async (trainScheduleSet: TrainScheduleSet) => {
      // create a copy of the published train schedule set as unpublished
      const { id: _id, ...tssWithoutId } = trainScheduleSet;
      const newTss = await createTrainScheduleSetMutation({
        trainScheduleSetForm: { ...tssWithoutId, published: false },
      }).unwrap();

      // link the new tss to the timetable and unlink the old published one
      await linkTrainScheduleSetToTimetable({
        id: timetableId,
        body: {
          train_schedule_set_ids: [
            ...(trainScheduleSets
              ?.filter((tss) => tss.id !== trainScheduleSet.id)
              .map((tss) => tss.id) ?? []),
            newTss.id,
          ],
        },
      }).unwrap();

      // copy all the trains that were attached to the old published tss
      const trainsToCopy: TrainSchedule[] = [...trainSchedules.values()]
        .filter((trainSchedule) => trainSchedule.train_schedule_set_id === trainScheduleSet.id)
        .map((trainSchedule) => {
          const {
            id: __id,
            train_schedule_set_id: _train_schedule_set_id,
            ...rest
          } = trainSchedule;

          return {
            ...rest,
          };
        });

      // create the trains and attach them to the new local tss
      const createdTrains = await createTrainSchedules(dispatch, newTss.id, trainsToCopy);

      upsertTrainSchedules(createdTrains);
    },
    [
      createTrainScheduleSetMutation,
      createTrainSchedules,
      linkTrainScheduleSetToTimetable,
      timetableId,
      trainScheduleSets,
      trainSchedules,
    ]
  );

  const getTrainScheduleSetByCatalogAndName = useCallback(
    (name: string, catalogId: number) => {
      const found = trainScheduleSets?.find(
        (tss) => tss.catalog_entry_id === catalogId && tss.name === name && tss.published
      );
      return found || null;
    },
    [trainScheduleSets]
  );

  const publishTrainScheduleSet = useCallback(
    async (trainScheduleSet: TrainScheduleSet, data: TrainScheduleSetFormData): Promise<void> => {
      // Do some checks
      if (trainScheduleSet.published) {
        throw new Error(t('alreadyPublished'));
      }

      if (!data.catalog) {
        throw new Error(t('catalogEntryRequired'));
      }

      if (!data.name) {
        throw new Error(t('nameRequired'));
      }

      if ('id' in data.catalog) {
        const foundSameName = getTrainScheduleSetByCatalogAndName(data.name, data.catalog.id);

        if (foundSameName && foundSameName.id !== trainScheduleSet.id) {
          throw new Error(t('tssNameDuplicate', { name: data.name, catalogId: data.catalog.id }));
        }
      }

      await updateTrainScheduleSet(trainScheduleSet, { ...data, published: true });
    },
    [t, getTrainScheduleSetByCatalogAndName, updateTrainScheduleSet]
  );

  const importTrainScheduleSets = useCallback(
    async (data: ImportTrainScheduleSetsPayload) => {
      if (!trainScheduleSets) {
        throw new Error('Timetable train schedule sets not loaded');
      }

      const existingIds = trainScheduleSets.map((tss) => tss.id);

      const newIds = [];
      const allTrainsToUpsert = [];

      for (const item of data) {
        if (item.type === 'reference') {
          // For reference imports, just link the existing train schedule set
          if (!existingIds.includes(item.trainScheduleSet.id)) {
            newIds.push(item.trainScheduleSet.id);
          }

          const referencedTrainSchedules = await getTrainScheduleSetTrainSchedules({
            id: item.trainScheduleSet.id,
          }).unwrap();

          allTrainsToUpsert.push(...referencedTrainSchedules);
        } else {
          // For copy imports, create a new train schedule set and copy the trains
          const sourceTrainSchedules = await getTrainScheduleSetTrainSchedules({
            id: item.trainScheduleSet.id,
          }).unwrap();

          const newTss = await createTrainScheduleSetMutation({
            trainScheduleSetForm: {
              name: item.trainScheduleSet.name,
              catalog_entry_id: item.trainScheduleSet.catalog_entry_id,
              published: false,
              description: item.trainScheduleSet.description,
              timetable_type: scenario.timetable_type,
            },
          }).unwrap();

          newIds.push(newTss.id);

          const trainsWithoutIds = sourceTrainSchedules.map(({ id: _id, ...train }) => ({
            ...train,
            train_schedule_set_id: newTss.id,
          }));

          const createdTrains = await createTrainSchedules(dispatch, newTss.id, trainsWithoutIds);

          allTrainsToUpsert.push(...createdTrains);
        }
      }

      const mergedIds = [...existingIds, ...newIds];

      await linkTrainScheduleSetToTimetable({
        id: timetableId,
        body: {
          train_schedule_set_ids: mergedIds,
        },
      }).unwrap();

      if (allTrainsToUpsert.length > 0) {
        upsertTrainSchedules(allTrainsToUpsert);
      }
    },
    [
      trainScheduleSets,
      getTrainScheduleSetTrainSchedules,
      createTrainScheduleSetMutation,
      createTrainSchedules,
      linkTrainScheduleSetToTimetable,
      timetableId,
      upsertTrainSchedules,
      scenario.timetable_type,
    ]
  );

  const trainSchedulesByTrainScheduleSets = useMemo(() => {
    if (!trainScheduleSets) return null;

    // We group trains by trainScheduleSet
    const trainsByTrainScheduleSetId = new Map<number, TrainScheduleWithDetails[]>();
    for (const trainSchedule of trainSchedulesWithDetails) {
      const trainScheduleInIndex = trainsByTrainScheduleSetId.get(
        trainSchedule.train_schedule_set_id
      );
      if (!trainScheduleInIndex) {
        trainsByTrainScheduleSetId.set(trainSchedule.train_schedule_set_id, [trainSchedule]);
      } else {
        trainsByTrainScheduleSetId.set(trainSchedule.train_schedule_set_id, [
          ...trainScheduleInIndex,
          trainSchedule,
        ]);
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
      .map((trainScheduleSet): TrainSchedulesByTrainScheduleSet => ({
        trainScheduleSet,
        trains: trainsByTrainScheduleSetId.get(trainScheduleSet.id) || [],
        catalog: trainScheduleSet.catalog_entry_id
          ? catalogEntriesIndex.get(trainScheduleSet.catalog_entry_id)
          : undefined, // can happen if it's the sandbox
      }));
  }, [trainScheduleSets, catalogEntries, trainSchedulesWithDetails]);

  const manageTrainScheduleSet = useMemo(
    (): TrainScheduleSetManager => ({
      createSet: createTrainScheduleSet,
      publishSet: publishTrainScheduleSet,
      getSetByCatalogAndName: getTrainScheduleSetByCatalogAndName,
      localCopySet: localCopyTrainScheduleSet,
      updateSet: updateTrainScheduleSet,
      removeSet: removeTrainScheduleSet,
    }),
    [
      createTrainScheduleSet,
      publishTrainScheduleSet,
      getTrainScheduleSetByCatalogAndName,
      localCopyTrainScheduleSet,
      updateTrainScheduleSet,
      removeTrainScheduleSet,
    ]
  );

  return {
    catalogEntries: catalogEntries ?? [],
    trainSchedulesByTrainScheduleSets,
    manageTrainScheduleSet,
    importTrainScheduleSets,
  } satisfies {
    catalogEntries?: CatalogEntry[];
    trainSchedulesByTrainScheduleSets: TrainSchedulesByTrainScheduleSet[] | null;
    manageTrainScheduleSet: TrainScheduleSetManager;
    importTrainScheduleSets: (data: ImportTrainScheduleSetsPayload) => Promise<void>;
  };
}
