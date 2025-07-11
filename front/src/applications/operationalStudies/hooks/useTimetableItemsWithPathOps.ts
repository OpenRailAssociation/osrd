import { useMemo } from 'react';

import {
  osrdEditoastApi,
  type OperationalPoint,
  type PathItemLocation,
} from 'common/api/osrdEditoastApi';
import type { TimetableItem, TimetableItemWithPathOps } from 'reducers/osrdconf/types';

import { isOperationalPointReference } from '../utils';

const useTimetableItemsWithPathOps = (
  infraId: number,
  timetableItems: TimetableItem[] | undefined
) => {
  // Extract all unique PathItemLocation from timetableItems.path
  const { timetableOpRefs, timetableItemsWithKeys } = useMemo(() => {
    if (!timetableItems) return { timetableOpRefs: [], timetableItemsWithKeys: [] };
    const uniqueSteps = new Map<string, PathItemLocation>();
    const timetableItemsDict: { timetableItem: TimetableItem; pathStepKeys: string[] }[] = [];
    for (const timetableItem of timetableItems) {
      const pathStepKeys = [];
      for (const pathItem of timetableItem.path) {
        const { id: _id, deleted: _deleted, ...cleanPathItem } = pathItem;
        const pathItemLocation: PathItemLocation = cleanPathItem;
        const key = JSON.stringify(pathItemLocation);
        uniqueSteps.set(key, pathItemLocation);
        pathStepKeys.push(key);
      }
      // Keep for each timetableItem, the keys of its path steps, this will help later
      // to match them with their corresponding operational points
      timetableItemsDict.push({ timetableItem, pathStepKeys });
    }
    return {
      timetableOpRefs: Array.from(uniqueSteps.values()).filter((pathItem) =>
        isOperationalPointReference(pathItem)
      ),
      timetableItemsWithKeys: timetableItemsDict,
    };
  }, [timetableItems]);

  const { currentData: timetableOperationalPoints } =
    osrdEditoastApi.endpoints.matchAllOperationalPoints.useQuery(
      {
        infraId,
        opRefs: timetableOpRefs,
      },
      { skip: timetableOpRefs.length === 0 }
    );

  const timetableItemsWithOps: TimetableItemWithPathOps[] = useMemo(() => {
    if (!timetableOperationalPoints || timetableOperationalPoints.length === 0) {
      return [];
    }

    // Map each operational point reference (path step) to its corresponding operational points
    const opsByKey = new Map<string, OperationalPoint[]>();
    timetableOperationalPoints.forEach((ops, i) => {
      const key = JSON.stringify(timetableOpRefs[i]);
      opsByKey.set(key, ops);
    });

    // For each timetable item, fill the pathOps property with
    // their corresponding operational points
    return timetableItemsWithKeys.map(({ timetableItem, pathStepKeys }) => {
      // For each pathStepKeys, find its corresponding operational points :
      // 1. if found, return the operational points
      // 2. if key exists but no operational points were found, return an empty array
      // 3. if key does not exist in opsByKey (meaning it's a track offset), return an empty array
      const pathOps = pathStepKeys.map((key) => opsByKey.get(key) ?? []);
      return { ...timetableItem, pathOps };
    });
  }, [timetableOperationalPoints]);

  return timetableItemsWithOps;
};

export default useTimetableItemsWithPathOps;
