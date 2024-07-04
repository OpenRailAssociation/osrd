import { useState, useEffect } from 'react';

import { isEqual } from 'lodash';
import { useSelector } from 'react-redux';

import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { useOsrdConfSelectors } from 'common/osrdContext';

export default function useInfraStatus() {
  const { getInfraID } = useOsrdConfSelectors();
  const infraId = useSelector(getInfraID, isEqual);

  const [reloadInfra] = osrdEditoastApi.endpoints.postInfraByInfraIdLoad.useMutation();

  const [isInfraLoaded, setIsInfraLoaded] = useState(false);
  const [reloadCount, setReloadCount] = useState(1);
  const [isInfraError, setIsInfraError] = useState(false);

  const { data: infra } = osrdEditoastApi.endpoints.getInfraByInfraId.useQuery(
    { infraId: infraId as number },
    {
      refetchOnMountOrArgChange: true,
      pollingInterval: !isInfraLoaded ? 1000 : undefined,
      skip: !infraId,
    }
  );

  useEffect(() => {
    if (reloadCount <= 5 && infra && infra.state === 'TRANSIENT_ERROR') {
      setTimeout(() => {
        reloadInfra({ infraId: infraId as number }).unwrap();
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
          reloadInfra({ infraId: infraId as number }).unwrap();
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
      reloadInfra({ infraId: infraId as number }).unwrap();
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
