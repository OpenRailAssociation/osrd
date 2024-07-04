import { useCallback, useEffect, useState } from 'react';

import { isNil } from 'lodash';

import { osrdEditoastApi } from 'common/api/osrdEditoastApi';

import type { SwitchType } from './types';

// Client preferred order
const trackNodeTypeOrder = [
  'link',
  'point_switch',
  'crossing',
  'single_slip_switch',
  'double_slip_switch',
];

let switchTypesCache: Record<number, SwitchType[]> = {};

export default function useSwitchTypes(infraID: number | undefined) {
  const [data, setData] = useState<SwitchType[]>(
    !isNil(infraID) ? switchTypesCache[infraID] || [] : []
  );
  const [getInfraSwitchTypes, { isLoading, error }] =
    osrdEditoastApi.endpoints.getInfraByInfraIdSwitchTypes.useLazyQuery({});
  const invalidateCache = useCallback(() => {
    switchTypesCache = {};
  }, [switchTypesCache]);

  const fetch = useCallback(
    async (infraId?: number) => {
      // Reset state:
      setData([]);

      if (isNil(infraId)) {
        return;
      }

      // Check cache first:
      if (switchTypesCache[infraId]) {
        setData(switchTypesCache[infraId]);
        return;
      }

      try {
        const resp = getInfraSwitchTypes({ infraId }, true);
        const result = await resp.unwrap();
        if (result) {
          const orderedData = [...result] as SwitchType[];
          orderedData.sort(
            (a, b) => trackNodeTypeOrder.indexOf(a.id) - trackNodeTypeOrder.indexOf(b.id)
          );
          setData(orderedData);
          switchTypesCache[infraId] = orderedData;
        } else {
          setData([]);
        }
        resp.unsubscribe();
      } catch (e) {
        console.error(e);
      }
    },
    [getInfraSwitchTypes]
  );

  useEffect(() => {
    fetch(infraID);
  }, [infraID, fetch]);

  return { data, isLoading, error, invalidateCache };
}
