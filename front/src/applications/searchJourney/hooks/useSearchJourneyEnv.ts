import { useCallback, useEffect, useState } from 'react';

import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { setSearchJourneyEnv } from 'reducers/searchJourney';
import { useAppDispatch } from 'store';

export const NO_CONFIG_FOUND_MSG = 'No configuration found';

/**
 * Hook in charge of loading the search journey environment (infra + timetables)
 * by calling `GET /search_journeys/search_environment` and dispatching `setSearchJourneyEnv`.
 */
export default function useSearchJourneyEnv() {
  const dispatch = useAppDispatch();
  const [getSearchJourneysSearchEnvironment] =
    osrdEditoastApi.endpoints.getSearchJourneysSearchEnvironment.useLazyQuery();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<null | Error>(null);

  const loadSearchJourneyEnv = useCallback(async () => {
    try {
      setError(null);
      setLoading(true);

      // Kept in sync with useStdcmEnv's { data } + manual throw pattern for consistency.
      const { data } = await getSearchJourneysSearchEnvironment();
      if (!data) throw new Error(NO_CONFIG_FOUND_MSG);
      dispatch(
        setSearchJourneyEnv({
          infraId: data.infra_id,
          timetableIds: data.timetable_ids,
        })
      );
    } catch (e) {
      setError(e as Error);
    } finally {
      setLoading(false);
    }
  }, [getSearchJourneysSearchEnvironment, dispatch]);

  useEffect(() => {
    loadSearchJourneyEnv();
  }, [loadSearchJourneyEnv]);

  return { loading, error, loadSearchJourneyEnv };
}
