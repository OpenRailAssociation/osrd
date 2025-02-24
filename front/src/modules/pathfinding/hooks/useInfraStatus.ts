import { useState, useEffect } from 'react';

import { osrdEditoastApi } from 'common/api/osrdEditoastApi';

export default function useInfraStatus({ infraId }: { infraId: number | undefined }) {
  const [reloadInfra] = osrdEditoastApi.endpoints.postInfraByInfraIdLoad.useMutation();

  const [isInfraLoaded, setIsInfraLoaded] = useState(false);
  const [reloadCount, setReloadCount] = useState(1);
  const [isInfraError, setIsInfraError] = useState(false);

  const { data: infra } = osrdEditoastApi.endpoints.getInfraByInfraId.useQuery(
    { infraId: infraId! },
    {
      refetchOnMountOrArgChange: true,
      pollingInterval: !isInfraLoaded ? 1000 : undefined,
      skip: !infraId,
    }
  );

  useEffect(() => {
    if (reloadCount <= 5 && infra && infra.state === 'TRANSIENT_ERROR') {
      setTimeout(() => {
        reloadInfra({ infraId: infraId! }).unwrap();
        setReloadCount((count) => count + 1);
      }, 1000);
    }
  }, [infra, reloadCount]);

  useEffect(() => {
    if (infraId) {
      reloadInfra({ infraId }).unwrap();
    }
  }, [infraId]);

  useEffect(() => {
    if (infra) {
      switch (infra.state) {
        case 'DOWNLOADING':
          setIsInfraLoaded(false);
          break;
        case 'NOT_LOADED': {
          reloadInfra({ infraId: infraId! }).unwrap();
          setIsInfraLoaded(false);
          break;
        }
        case 'ERROR':
        case 'TRANSIENT_ERROR': {
          setIsInfraLoaded(true);
          break;
        }
        case 'CACHED': {
          setIsInfraLoaded(true);
          if (isInfraError) setIsInfraError(false);
          break;
        }
        default:
          break;
      }
    }
  }, [infra]);

  useEffect(() => {
    if (isInfraError) {
      reloadInfra({ infraId: infraId! }).unwrap();
      setIsInfraLoaded(false);
    }
  }, [isInfraError]);

  return {
    infra,
    isInfraLoaded,
    reloadCount,
    setIsInfraError,
  };
}
