import { useState, useEffect } from 'react';

import { osrdEditoastApi } from 'common/api/osrdEditoastApi';

/**
 * Hook used to launch a worker on which the asked infra and timetable are loaded
 * Return the worker status
 *
 * A worker with a timetable and a infra can only used for stdcm requests.
 */
export default function useWorkerStatus({
  infraId,
  timetableId,
}: {
  infraId: number | undefined;
  timetableId?: number;
}) {
  const [shouldPoll, setShouldPoll] = useState(true);

  // This endpoint initializes a worker, loads the required infrastructure on it, and optionally caches
  // the timetable to speed up stdcm requests.
  const { data: workerStatus = 'NOT_READY' } = osrdEditoastApi.endpoints.postWorkerLoad.useQuery(
    { body: { infra_id: infraId!, timetable_id: timetableId } },
    {
      refetchOnMountOrArgChange: true,
      pollingInterval: shouldPoll ? 1000 : undefined,
      skip: !infraId,
    }
  );

  useEffect(() => {
    if (infraId) {
      setShouldPoll(true);
    }
  }, [infraId]);

  useEffect(() => {
    if (workerStatus) {
      switch (workerStatus) {
        case 'READY':
        case 'ERROR': {
          setShouldPoll(false);
          break;
        }
        default:
          break;
      }
    }
  }, [workerStatus]);

  return workerStatus;
}
