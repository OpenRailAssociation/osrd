import { useMemo } from 'react';

import { skipToken } from '@reduxjs/toolkit/query';

import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import type { TimetableItem, TimetableItemWithPathOps } from 'reducers/osrdconf/types';

import { getUniqueOpRefsFromTimetableItems, addPathOpsToTimetableItems } from '../utils';

const useTimetableItemsWithPathOps = (
  infraId: number,
  timetableItems: TimetableItem[] | undefined
): TimetableItemWithPathOps[] => {
  // Extract all unique PathItemLocation from timetableItems.path
  const timetableOpRefs = useMemo(
    () => getUniqueOpRefsFromTimetableItems(timetableItems ?? []),
    [timetableItems]
  );

  const { currentData: timetableOperationalPoints, isSuccess } =
    osrdEditoastApi.endpoints.matchAllOperationalPoints.useQuery(
      timetableOpRefs.length > 0 ? { infraId, opRefs: timetableOpRefs } : skipToken
    );

  return useMemo(() => {
    if (!timetableItems || (!isSuccess && timetableOpRefs.length !== 0)) {
      return [];
    }

    return addPathOpsToTimetableItems(
      timetableItems,
      timetableOpRefs,
      timetableOperationalPoints ?? []
    );
  }, [timetableItems, timetableOperationalPoints, timetableOpRefs, isSuccess]);
};

export default useTimetableItemsWithPathOps;
