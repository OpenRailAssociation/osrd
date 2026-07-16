import { useCallback, useEffect, useState } from 'react';

export const NO_CONFIG_FOUND_MSG = 'No configuration found';

/**
 * Hook in charge of loading the search journey environment (infra + timetables)
 * by calling `GET /journey_search_environment` and dispatching `setSearchJourneyEnv`.
 *
 * TODO: wire this hook to the real editoast endpoint once it's available
 * Until then, it resolves with an error so that `SearchJourneyView`
 * falls back to its empty configuration state.
 */
export default function useSearchJourneyEnv() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<null | Error>(null);

  const loadSearchJourneyEnv = useCallback(async () => {
    try {
      setError(null);
      setLoading(true);

      throw new Error(NO_CONFIG_FOUND_MSG);
    } catch (e) {
      setError(e as Error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSearchJourneyEnv();
  }, [loadSearchJourneyEnv]);

  return { loading, error, loadSearchJourneyEnv };
}
