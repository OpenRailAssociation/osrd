import { useState, useEffect } from 'react';

import { osrdEditoastApi } from 'common/api/osrdEditoastApi';

export default function useInfraStatus({ infraId }: { infraId: number | undefined }) {
  const [reloadInfra] = osrdEditoastApi.endpoints.postInfraByInfraIdLoad.useMutation();

  const [isInfraLoaded, setIsInfraLoaded] = useState(false);

  const { data: infra } = osrdEditoastApi.endpoints.getInfraByInfraId.useQuery(
    { infraId: infraId! },
    {
      refetchOnMountOrArgChange: true,
      pollingInterval: !isInfraLoaded ? 1000 : undefined,
      skip: !infraId,
    }
  );

  useEffect(() => {
    if (infraId) {
      setIsInfraLoaded(false);
      reloadInfra({ infraId }).unwrap();
    }
  }, [infraId]);

  useEffect(() => {
    if (infra) {
      switch (infra.state) {
        case 'DOWNLOADING':
        case 'NOT_LOADED':
        case 'ERROR': {
          setIsInfraLoaded(false);
          break;
        }
        case 'TRANSIENT_ERROR':
        case 'CACHED': {
          setIsInfraLoaded(true);
          break;
        }
        default:
          break;
      }
    }
  }, [infra]);

  return {
    infra,
  };
}
