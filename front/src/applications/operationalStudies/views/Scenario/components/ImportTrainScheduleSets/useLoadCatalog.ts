import { useCallback, useEffect, useState } from 'react';

import { osrdEditoastApi } from 'common/api/osrdEditoastApi';

import type { CatalogById, TrainScheduleSetById } from './types';
import { mockListCatalogEntries } from '../../mockTrainScheduleSets';

export default function useLoadCatalog() {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const [data, setData] = useState<{
    catalog: CatalogById;
    trainScheduleSets: TrainScheduleSetById;
  } | null>(null);

  const loadCatalog = useCallback(async () => {
    setLoading(true);
    try {
      const catalog: CatalogById = new Map();
      const trainScheduleSets: TrainScheduleSetById = new Map();

      // Get all catalog entries
      const catalogEntriesResult = await mockListCatalogEntries();

      const [getTrainScheduleSets] = osrdEditoastApi.endpoints.getTrainScheduleSets.useLazyQuery();

      for (const catalogEntry of catalogEntriesResult) {
        const entryTss = await getTrainScheduleSets({
          catalogEntryId: catalogEntry.id,
        }).unwrap();
        catalog.set(catalogEntry.id, {
          ...catalogEntry,
          trainScheduleSetIds: entryTss.map((tss) => tss.id),
        });

        for (const tss of entryTss) {
          trainScheduleSets.set(tss.id, tss);
        }
      }

      setData({
        catalog,
        trainScheduleSets,
      });
    } catch (e) {
      setError(e as Error);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * When hook is mounted
   * => load the catalog
   */
  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  return { loading, error, data };
}
