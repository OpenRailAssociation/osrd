import { useCallback, useEffect, useState } from 'react';

import { useDispatch } from 'react-redux';

import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import {
  resetStdcmSimulations,
  updateStdcmEnvironment,
  updateStdcmEnvironmentActiveArea,
} from 'reducers/osrdconf/stdcmConf';

export const NO_CONFIG_FOUND_MSG = 'No configuration found';

export default function useStdcmEnvironment() {
  const dispatch = useDispatch();
  const [getStdcmSearchEnvironment] =
    osrdEditoastApi.endpoints.getStdcmSearchEnvironment.useLazyQuery();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<null | Error>(null);

  const loadStdcmEnvironment = useCallback(async () => {
    try {
      setError(null);
      setLoading(true);
      const { data } = await getStdcmSearchEnvironment();
      if (!data) throw new Error(NO_CONFIG_FOUND_MSG);
      dispatch(resetStdcmSimulations());
      dispatch(
        updateStdcmEnvironment({
          infraID: data.infra_id,
          timetableID: data.timetable_id,
          electricalProfileSetId: data.electrical_profile_set_id ?? undefined,
          workScheduleGroupId: data.work_schedule_group_id ?? undefined,
          temporarySpeedLimitGroupId: data.temporary_speed_limit_group_id ?? undefined,
          searchDatetimeWindow: {
            begin: new Date(data.search_window_begin),
            end: new Date(data.search_window_end),
          },
          activePerimeter: data.active_perimeter ?? undefined,
          operationalPoints: data.operational_points ?? undefined,
          speedLimitTags: data.speed_limits ? data.speed_limits.speed_limit_tags : undefined,
          defaultSpeedLimitTag: data.speed_limits
            ? (data.speed_limits.default_speed_limit_tag ?? undefined)
            : undefined,
        })
      );
    } catch (e) {
      setError(e as Error);
    } finally {
      setLoading(false);
    }
  }, [getStdcmSearchEnvironment]);

  const resetStdcmEnvironment = useCallback(() => {
    dispatch(updateStdcmEnvironmentActiveArea(undefined));
  }, []);

  useEffect(() => {
    loadStdcmEnvironment();
  }, [loadStdcmEnvironment]);

  return { loading, error, loadStdcmEnvironment, resetStdcmEnvironment };
}
