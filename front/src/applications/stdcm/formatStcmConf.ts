import { Dispatch } from 'redux';
import { TFunction } from 'i18next';
import { PathQuery, PostStdcmApiArg } from 'common/api/osrdEditoastApi';

import { createAllowanceValue } from 'applications/stdcm/components/allowancesConsts';
import { STDCM_MODES, OsrdStdcmConfState } from 'applications/operationalStudies/consts';
import { time2sec } from 'utils/timeManipulation';
import { makeEnumBooleans } from 'utils/constants';

import { ActionFailure } from 'reducers/main';
import { ThunkAction } from 'types';
import { getPathfindingQuery } from 'common/Pathfinding/Pathfinding';

export default function formatStdcmConf(
  dispatch: Dispatch,
  setFailure: (e: Error) => ThunkAction<ActionFailure>,
  t: TFunction,
  osrdconf: OsrdStdcmConfState
): PostStdcmApiArg | undefined {
  const { isByOrigin, isByDestination } = makeEnumBooleans(STDCM_MODES, osrdconf.stdcmMode);

  let error = false;
  if (!osrdconf.origin) {
    error = true;
    dispatch(
      setFailure({
        name: t('osrdconf:errorMessages.trainScheduleTitle'),
        message: t('osrdconf:errorMessages.noOrigin'),
      })
    );
  }
  if (!(osrdconf.originTime && osrdconf.originUpperBoundTime) && isByOrigin) {
    error = true;
    dispatch(
      setFailure({
        name: t('osrdconf:errorMessages.trainScheduleTitle'),
        message: t('osrdconf:errorMessages.noOriginTime'),
      })
    );
  }
  if (!osrdconf.destination) {
    error = true;
    dispatch(
      setFailure({
        name: t('osrdconf:errorMessages.trainScheduleTitle'),
        message: t('osrdconf:errorMessages.noDestination'),
      })
    );
  }
  if (!osrdconf.destinationTime && isByDestination) {
    error = true;
    dispatch(
      setFailure({
        name: t('osrdconf:errorMessages.trainScheduleTitle'),
        message: t('osrdconf:errorMessages.noOriginTime'),
      })
    );
  }
  if (!osrdconf.rollingStockID) {
    error = true;
    dispatch(
      setFailure({
        name: t('osrdconf:errorMessages.trainScheduleTitle'),
        message: t('osrdconf:errorMessages.noRollingStock'),
      })
    );
  }
  if (!osrdconf.infraID) {
    error = true;
    dispatch(
      setFailure({
        name: t('osrdconf:errorMessages.trainScheduleTitle'),
        message: t('osrdconf:errorMessages.noName'),
      })
    );
  }
  if (!osrdconf.timetableID) {
    error = true;
    dispatch(
      setFailure({
        name: t('osrdconf:errorMessages.trainScheduleTitle'),
        message: t('osrdconf:errorMessages.noTimetable'),
      })
    );
  }

  if (!error) {
    const originDate = osrdconf.originTime ? time2sec(osrdconf.originTime) : undefined;
    const destinationDate = osrdconf.destinationTime
      ? time2sec(osrdconf.destinationTime)
      : undefined;
    const maximumDepartureDelay =
      time2sec(osrdconf.originUpperBoundTime as string) - time2sec(osrdconf.originTime as string);

    const standardAllowance = createAllowanceValue(
      osrdconf.standardStdcmAllowance?.type,
      osrdconf.standardStdcmAllowance?.value
    );

    // we already checked that everything is defined
    const pathfindingQuery = getPathfindingQuery(osrdconf) as PathQuery;
    const osrdConfStdcm = {
      body: {
        steps: pathfindingQuery.steps,
        rolling_stocks: pathfindingQuery.rolling_stocks,
        infra_id: pathfindingQuery.infra,
        rolling_stock_id: osrdconf.rollingStockID as number,
        comfort: osrdconf.rollingStockComfort,
        timetable_id: osrdconf.timetableID as number,
        start_time: originDate,
        end_time: destinationDate,
        maximum_departure_delay: maximumDepartureDelay,
        speed_limit_tags: osrdconf.speedLimitByTag,
        margin_before: osrdconf.gridMarginBefore,
        margin_after: osrdconf.gridMarginAfter,
        standard_allowance: standardAllowance,
        maximum_run_time: osrdconf.maximumRunTime,
      },
    };

    return osrdConfStdcm;
  }
  return undefined;
}
