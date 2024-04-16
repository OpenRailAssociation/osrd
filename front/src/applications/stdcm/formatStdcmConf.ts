import type { TFunction } from 'i18next';
import type { Dispatch } from 'redux';

import type { PathfindingRequest, PostStdcmApiArg } from 'common/api/osrdEditoastApi';
import { getPathfindingQuery } from 'modules/pathfinding/components/Pathfinding/Pathfinding';
import { createAllowanceValue } from 'modules/stdcmAllowances/allowancesConsts';
import type { InfraState } from 'reducers/infra';
import { setFailure } from 'reducers/main';
import type { OsrdStdcmConfState } from 'reducers/osrdconf/types';
import { time2sec } from 'utils/timeManipulation';

export default function formatStdcmConf(
  dispatch: Dispatch,
  t: TFunction,
  osrdconf: OsrdStdcmConfState & InfraState
): PostStdcmApiArg | undefined {
  let error = false;
  if (!osrdconf.origin) {
    error = true;
    dispatch(
      setFailure({
        name: t('operationalStudies/manageTrainSchedule:errorMessages.trainScheduleTitle'),
        message: t('operationalStudies/manageTrainSchedule:errorMessages.noOrigin'),
      })
    );
  }
  if (!(osrdconf.originTime && osrdconf.originUpperBoundTime)) {
    error = true;
    dispatch(
      setFailure({
        name: t('operationalStudies/manageTrainSchedule:errorMessages.trainScheduleTitle'),
        message: t('operationalStudies/manageTrainSchedule:errorMessages.noOriginTime'),
      })
    );
  }
  if (!osrdconf.destination) {
    error = true;
    dispatch(
      setFailure({
        name: t('operationalStudies/manageTrainSchedule:errorMessages.trainScheduleTitle'),
        message: t('operationalStudies/manageTrainSchedule:errorMessages.noDestination'),
      })
    );
  }
  if (!osrdconf.rollingStockID) {
    error = true;
    dispatch(
      setFailure({
        name: t('operationalStudies/manageTrainSchedule:errorMessages.trainScheduleTitle'),
        message: t('operationalStudies/manageTrainSchedule:errorMessages.noRollingStock'),
      })
    );
  }
  if (!osrdconf.infraID) {
    error = true;
    dispatch(
      setFailure({
        name: t('operationalStudies/manageTrainSchedule:errorMessages.trainScheduleTitle'),
        message: t('operationalStudies/manageTrainSchedule:errorMessages.noName'),
      })
    );
  }
  if (!osrdconf.timetableID) {
    error = true;
    dispatch(
      setFailure({
        name: t('operationalStudies/manageTrainSchedule:errorMessages.trainScheduleTitle'),
        message: t('operationalStudies/manageTrainSchedule:errorMessages.noTimetable'),
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
    const pathfindingQuery = getPathfindingQuery(osrdconf) as PathfindingRequest;
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
