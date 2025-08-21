import { useState, useEffect, useMemo } from 'react';

import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import type { InfraWithStatus } from 'modules/infra/types';

export default function useInfraStatus({
  infraId,
  timetableId,
}: {
  infraId: number | undefined;
  timetableId?: number;
}): { infra?: InfraWithStatus } {
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

  const { data: infra } = osrdEditoastApi.endpoints.getInfraByInfraId.useQuery(
    { infraId: infraId! },
    {
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

  return useMemo(
    () => ({
      infra: infra ? { ...infra, status: workerStatus } : undefined,
    }),
    [infra, workerStatus]
  );
}
