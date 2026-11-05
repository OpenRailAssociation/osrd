import { useState } from 'react';

import { skipToken } from '@reduxjs/toolkit/query';
import { useSelector } from 'react-redux';

import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { osrdRailwayManagerApi } from 'common/api/osrdRailwayManagerApi';
import { getStdcmInfraID } from 'reducers/osrdconf/stdcmConf/selectors';

const useStdcmRequestsSent = () => {
  'use memo';

  const infraId = useSelector(getStdcmInfraID);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // 1. Get sent requests IDs from editoast
  const {
    data: stdcmRequests,
    isLoading: idsLoading,
    refetch: refetchIDs,
  } = osrdEditoastApi.endpoints.getStdcmRequests.useQuery({
    by: 'user',
  });

  // 2. Get requests statuses from railway manager interface
  const {
    data: statusesById,
    isLoading: statusLoading,
    refetch: refetchStatuses,
    fulfilledTimeStamp: lastRefresh,
  } = osrdRailwayManagerApi.endpoints.postSendLastMinuteRequestStatuses.useQuery(
    stdcmRequests ? { body: stdcmRequests.requests.map((request) => request.rmi_id) } : skipToken
  );

  const statuses = Object.values(statusesById ?? {});
  const operationalPointReferences = statuses.flatMap((status) => [status.begin_op, status.end_op]);

  // 3. Match ops from railway manager interface with ops from infra to get name and main_code
  const {
    data: matchedOps,
    isLoading: matchLoading,
    refetch: refetchOps,
  } = osrdEditoastApi.endpoints.postInfraByInfraIdMatchOperationalPoints.useQuery(
    infraId && operationalPointReferences.length > 0
      ? {
          infraId,
          body: { operational_point_references: operationalPointReferences },
        }
      : skipToken
  );

  const requestsSentData = statuses
    .map((status, index) => ({
      ...status,
      // related_operational_points is ordered like operationalPointReferences: [begin0, end0, begin1, end1, ...]
      matchedBeginOp: matchedOps?.related_operational_points[2 * index],
      matchedEndOp: matchedOps?.related_operational_points[2 * index + 1],
    }))
    .toSorted((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

  const refetchData = async () => {
    setIsRefreshing(true);
    try {
      await refetchIDs();
      await refetchStatuses();
      await refetchOps();
    } finally {
      setIsRefreshing(false);
    }
  };

  return {
    requestsSentData,
    isLoading: statusLoading || matchLoading || idsLoading,
    isRefreshing,
    refetchData,
    lastRefresh,
  };
};

export default useStdcmRequestsSent;
