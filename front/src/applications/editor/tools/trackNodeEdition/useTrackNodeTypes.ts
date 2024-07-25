import { useCallback, useEffect, useState } from 'react';

import { isNil } from 'lodash';

import { osrdEditoastApi } from 'common/api/osrdEditoastApi';

import type { TrackNodeType } from './types';

// Client preferred order
const trackNodeTypeOrder = [
  'link',
  'point_switch',
  'crossing',
  'single_slip_switch',
  'double_slip_switch',
];

let trackNodeTypesCache: Record<number, TrackNodeType[]> = {};

export default function useTrackNodeTypes(infraID: number | undefined) {
  const [data, setData] = useState<TrackNodeType[]>(
    !isNil(infraID) ? trackNodeTypesCache[infraID] || [] : []
  );
  const [getInfraTrackNodeTypes, { isLoading, error }] =
    osrdEditoastApi.endpoints.getInfraByInfraIdTrackNodeTypes.useLazyQuery({});
  const invalidateCache = useCallback(() => {
    trackNodeTypesCache = {};
  }, [trackNodeTypesCache]);

  const fetch = useCallback(
    async (infraId?: number) => {
      // Reset state:
      setData([]);

      if (isNil(infraId)) {
        return;
      }

      // Check cache first:
      if (trackNodeTypesCache[infraId]) {
        setData(trackNodeTypesCache[infraId]);
        return;
      }

      try {
        const resp = getInfraTrackNodeTypes({ infraId }, true);
        const result = await resp.unwrap();
        if (result) {
          const orderedData = [...result] as TrackNodeType[];
          orderedData.sort(
            (a, b) => trackNodeTypeOrder.indexOf(a.id) - trackNodeTypeOrder.indexOf(b.id)
          );
          setData(orderedData);
          trackNodeTypesCache[infraId] = orderedData;
        } else {
          setData([]);
        }
        resp.unsubscribe();
      } catch (e) {
        console.error(e);
      }
    },
    [getInfraTrackNodeTypes]
  );

  useEffect(() => {
    fetch(infraID);
  }, [infraID, fetch]);

  return { data, isLoading, error, invalidateCache };
}
