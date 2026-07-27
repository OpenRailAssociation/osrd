import { useCallback, useEffect, useState } from 'react';

import { useScenarioContext } from 'applications/operationalStudies/hooks/useScenarioContext';
import type { ApiError } from 'common/api/baseGeneratedApis';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';

import type { CatalogById, TrainScheduleSetById } from './types';

/**
 * Loads the train schedule set catalog for the scenario's timetable.
 *
 * For each catalog entry, fetches its published train schedule sets; entries with none are dropped from the result.
 * Also exposes the set of train schedule set ids already imported into the timetable from the catalog.
 */
export default function useLoadCatalog() {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [data, setData] = useState<{
    catalog: CatalogById;
    trainScheduleSets: TrainScheduleSetById;
  } | null>(null);

  const { scenario } = useScenarioContext();

  const { currentData: catalogData } = osrdEditoastApi.endpoints.getAllCatalogEntries.useQuery({});

  const [getTrainScheduleSets] = osrdEditoastApi.endpoints.getTrainScheduleSets.useLazyQuery();

  const { data: tsss = [] } = osrdEditoastApi.endpoints.getTimetableByIdTrainScheduleSets.useQuery({
    id: scenario.timetable_id,
  });

  const trainScheduleSetsAlreadyImported = new Set(
    tsss.filter((tss) => tss.catalog_entry_id).map((tss) => tss.id)
  );

  const loadCatalog = useCallback(async () => {
    if (!catalogData) return;

    setLoading(true);
    try {
      const catalog: CatalogById = new Map();
      const trainScheduleSets: TrainScheduleSetById = new Map();

      const entriesTss = await Promise.all(
        catalogData.map((catalogEntry) =>
          getTrainScheduleSets({
            catalogEntryId: catalogEntry.id,
            published: true,
          }).unwrap()
        )
      );

      catalogData.forEach((catalogEntry, index) => {
        const entryTss = entriesTss[index];

        if (entryTss.length > 0) {
          catalog.set(catalogEntry.id, {
            ...catalogEntry,
            trainScheduleSetIds: entryTss.map((tss) => tss.id),
          });

          for (const tss of entryTss) {
            trainScheduleSets.set(tss.id, tss);
          }
        }
      });

      setData({
        catalog,
        trainScheduleSets,
      });
    } catch (e) {
      setError(e as ApiError);
    } finally {
      setLoading(false);
    }
  }, [catalogData, getTrainScheduleSets]);

  /**
   * When hook is mounted
   * => load the catalog
   */
  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  return { loading, error, data, trainScheduleSetsAlreadyImported };
}
