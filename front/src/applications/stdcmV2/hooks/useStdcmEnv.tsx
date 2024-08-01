import { useCallback, useEffect, useState } from 'react';

import { useDispatch } from 'react-redux';

import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { useOsrdConfActions } from 'common/osrdContext';
import type { StdcmConfSliceActions } from 'reducers/osrdconf/stdcmConf';

export const NO_CONFIG_FOUND_MSG = 'No configuration found';

export default function useStdcmEnvironment() {
  const dispatch = useDispatch();
  const { updateStdcmEnvironment } = useOsrdConfActions() as StdcmConfSliceActions;
  const [getStdcmSearchEnvironment] =
    osrdEditoastApi.endpoints.getStdcmSearchEnvironment.useLazyQuery();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<null | Error>(null);

  const loadStdcmEnvironment = useCallback(async () => {
    try {
      setError(null);
      setLoading(true);
      const { data } = await getStdcmSearchEnvironment();
      if (!data) throw new Error(NO_CONFIG_FOUND_MSG);
      dispatch(
        updateStdcmEnvironment({
          infraID: data.infra_id,
          timetableID: data.timetable_id,
          electricalProfileSetId: data.electrical_profile_set_id,
          workScheduleGroupId: data.work_schedule_group_id,
          searchDatetimeWindow: {
            begin: new Date(data.search_window_begin),
            end: new Date(data.search_window_end),
          },
        })
      );
    } catch (e) {
      setError(e as Error);
    } finally {
      setLoading(false);
    }
  }, [getStdcmSearchEnvironment]);

  useEffect(() => {
    loadStdcmEnvironment();
  }, [loadStdcmEnvironment]);

  return { loading, error };
}
