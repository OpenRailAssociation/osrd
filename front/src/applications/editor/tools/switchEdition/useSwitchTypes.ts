import { useCallback, useEffect, useState } from 'react';

import { isNil } from 'lodash';

import { osrdEditoastApi } from 'common/api/osrdEditoastApi';

import type { SwitchType } from './types';

// Client prefered order
const trackNodeTypeOrder = [
  'link',
  'point_switch',
  'crossing',
  'single_slip_switch',
  'double_slip_switch',
];

export default function useSwitchTypes(infraID: number | undefined) {
  const [data, setData] = useState<SwitchType[]>([]);
  const [getInfraSwitchTypes, { isLoading, error }] =
    osrdEditoastApi.endpoints.getInfraByInfraIdSwitchTypes.useLazyQuery({});

  const fetch = useCallback(
    async (infraId?: number) => {
      // reset
      setData([]);
      try {
        if (!isNil(infraId)) {
          const resp = getInfraSwitchTypes({ infraId });
          const result = await resp.unwrap();
          if (result) {
            const orderedData = [...result] as SwitchType[];
            orderedData.sort(
              (a, b) => trackNodeTypeOrder.indexOf(a.id) - trackNodeTypeOrder.indexOf(b.id)
            );
            setData(orderedData);
          } else {
            setData([]);
          }
          resp.unsubscribe();
        }
      } catch (e) {
        console.error(e);
      }
    },
    [getInfraSwitchTypes]
  );

  useEffect(() => {
    fetch(infraID);
  }, [infraID, fetch]);

  return { data, isLoading, error };
}
